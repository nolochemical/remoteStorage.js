define(['./sync', './store'], function (sync, store) {
  var moduleChangeHandlers = {};
  function extractModuleName(path) {
    if (path && typeof(path) == 'string') {
      var parts = path.split('/');
      if(parts.length > 3 && parts[1] == 'public') {
        return parts[2];
      } else if(parts.length > 2){
        return parts[1];
      }
    }
  }
  store.on('change', function(eventObj) {//tab-, device- and cloud-based changes all get fired from the store.
    var moduleName = extractModuleName(eventObj.path);
    if(moduleName && moduleChangeHandlers[moduleName]) {
      moduleChangeHandlers[moduleName](eventObj);
    }
  });
  function set(moduleName, version, path, public, userAddress, valueStr) {
    var absPath = makePath(moduleName, version, path, public, userAddress),
      node = store.getNode(absPath);
    node.outgoingChange = true;
    var changeEvent = {
      origin: 'window',
      oldValue: node.data,
      newValue: valueStr,
      path: path
    };
    node.data = valueStr;
    var ret = store.updateNode(absPath, node);
    moduleChangeHandlers[moduleName](changeEvent);
    return ret; 
  }
  function makePath(moduleName, version, path, public, userAddress) {
    return (userAddress ?'//'+userAddress:'/')+(public?'public/':'')+moduleName+'/'+version+'/'+path;
  }
  function claimAccess(path, claim) {
    var node = store.getNode(path);
    store.access = claim;
    store.updateNode(path, node);
  }
  function isDir(path) {
    return (path.substr(-1)=='/');
  }
  return {
    getInstance : function(moduleName, version, accessClaim) {
      claimAccess('/'+moduleName+'/'+version+'/', accessClaim);
      claimAccess('/public/'+moduleName+'/'+version+'/', accessClaim);
      return {
        on          : function(eventType, cb) {//'error' or 'change'. Change events have a path and origin (tab, device, cloud) field
          if(eventType=='change') {
            moduleChangeHandlers[moduleName] = cb;
          }
        },
        get         : function(path, public, userAddress, cb) {
          if(cb) {
            sync.fetchNow(makePath(moduleName, version, path, public, userAddress), function(err) {
              var node = store.getNode(makePath(moduleName, version, path, public, userAddress));
              cb(node.data);
            });
          } else {
            var node = store.getNode(makePath(moduleName, version, path, public, userAddress));
            return node.data;
          }
        },
        remove      : function(path, public) {
          return set(moduleName, version, path, public);
        },
        
        storeObject : function(path, public, type, obj) {
          obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+type;
          //checkFields(obj);
          return set(moduleName, version, path, public, undefined, JSON.stringify(obj));
        },
        storeMedia  : function(path, mimeType, data) {
          return set(moduleName, version, path, public, undefined, data);
        },
        
        connect     : function(path, public, userAddress, switchVal) {
          var absPath = makePath(moduleName, version, path, public, userAddress);
          var node = store.getNode(absPath);
          node.startForcing = (switchVal != false);
          store.updateNode(absPath, node);
        },
        getState    : function(path, public, userAddress, switchVal) {
        }
      };
    }
  };
});
