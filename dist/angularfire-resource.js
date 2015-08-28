String.prototype.capitalize = function() {
  return this.slice(0, 1).toUpperCase() + this.slice(1).toLowerCase();
};

String.prototype.camelize = function(firstUp) {
  var result;
  if (firstUp == null) {
    firstUp = false;
  }
  result = this.replace(/[\s|_|-](.)/g, function($1) {
    return $1.toUpperCase();
  }).replace(/[\s|_|-]/g, '').replace(/^(.)/, function($1) {
    return $1.toLowerCase();
  });
  if (firstUp) {
    return result.slice(0, 1).toUpperCase() + result.slice(1);
  } else {
    return result;
  }
};

angular.module('angularfire-resource', []);

angular.module('angularfire-resource').factory('AssociationFactory', function($injector, $firebaseUtils, AssociationCollection) {
  var AssociationsFactory;
  return AssociationsFactory = (function() {
    var HasMany, ensure_options, getResourceId, privateKey, publicKey, throwError;

    publicKey = function(name) {
      return '$' + name;
    };

    privateKey = function(name) {
      return '$$' + name;
    };

    getResourceId = function(resource) {
      if (angular.isObject(resource)) {
        return resource.$id;
      } else {
        return resource;
      }
    };

    throwError = function(Resource, type, name, key) {
      throw "Exception : " + (Resource.$name.camelize(true)) + " " + type + " " + name + ", " + key + " is mandatory";
    };

    ensure_options = function(Resource, type, name, opts) {
      var i, key, len, ref;
      ref = ['className', 'inverseOf'];
      for (i = 0, len = ref.length; i < len; i++) {
        key = ref[i];
        if (!opts[key]) {
          throwError(Resource, type, name, key);
        }
      }
      if (type !== 'hasMany' && (opts.foreignKey == null)) {
        throwError(Resource, type, name, 'foreignKey');
      }
      return true;
    };

    function AssociationsFactory(Resource) {
      this.Resource = Resource;
      this.map = {};
    }

    AssociationsFactory.prototype._addToMap = function(type, name, opts) {
      ensure_options(this.Resource, type, name, opts);
      return this.map[name] = angular.extend({
        name: name,
        type: type
      }, opts);
    };

    AssociationsFactory.prototype.create = function(type, name, opts, cb) {
      this._addToMap(type, name, opts);
      this['create' + type.camelize(true)](name, opts, cb);
      return this.Resource;
    };

    AssociationsFactory.prototype.inverseOf = function(name) {
      var assoc, key, opts, ref;
      assoc = null;
      ref = this.map;
      for (key in ref) {
        opts = ref[key];
        if (opts.inverseOf === name) {
          assoc = opts;
          break;
        }
      }
      return assoc;
    };

    AssociationsFactory.prototype.get = function(name) {
      return this.map[name];
    };

    AssociationsFactory.prototype._ResourceAdd = function(name, cb) {
      return this.Resource.prototype[publicKey(name)] = cb;
    };

    HasMany = (function() {
      function HasMany(Resource, name, opts, cb) {}

      HasMany.prototype.remove = function() {};

      HasMany.prototype.add = function() {};

      return HasMany;

    })();

    AssociationsFactory.prototype.createHasMany = function(name, opts, cb) {
      var Resource;
      Resource = this.Resource;
      this.map[name].remove = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        Resource.$ref().child(getResourceId(params.from)).child(name).child(getResourceId(resource)).set(null, $firebaseUtils.makeNodeResolver(def));
        return def.promise;
      };
      this.map[name].add = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        Resource.$ref().child(getResourceId(params.to)).child(name).child(getResourceId(resource)).set(resource.$id, $firebaseUtils.makeNodeResolver(def));
        return def.promise;
      };
      return this._ResourceAdd(name, function(updateRef) {
        if (updateRef || !this[privateKey(name)]) {
          if (this[privateKey(name)]) {
            this[privateKey(name)].$destroy();
          }
          return this[privateKey(name)] = new AssociationCollection(this, name, opts, updateRef || cb);
        } else {
          return this[privateKey(name)];
        }
      });
    };

    AssociationsFactory.prototype.createHasOne = function(name, opts) {
      var Resource, association, reverseAssociation;
      reverseAssociation = function() {
        return $injector.get(opts.className)._assoc.get(opts.inverseOf);
      };
      association = this.map[name];
      Resource = this.Resource;
      this.map[name].remove = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        Resource.$ref().child(getResourceId(params.from)).child(opts.foreignKey).once('value', function(snap) {
          if (snap.val() !== resource.$id) {
            return snap.ref().set(null, $firebaseUtils.makeNodeResolver(def));
          }
        });
        return def.promise;
      };
      this.map[name].add = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        Resource.$ref().child(getResourceId(params.to)).child(opts.foreignKey).set(resource.$id, $firebaseUtils.makeNodeResolver(def));
        return def.promise;
      };
      this._ResourceAdd(name, function() {
        var klass, name1;
        klass = $injector.get(opts.className);
        if (this[opts.foreignKey] != null) {
          return this[name1 = privateKey(name)] || (this[name1] = klass.$find(this[opts.foreignKey]));
        } else {
          return null;
        }
      });
      this._ResourceAdd("set" + (name.camelize(true)), function(newResource) {
        var newResourceId, oldResourceId;
        oldResourceId = this[opts.foreignKey];
        newResourceId = angular.isObject(newResource) ? newResource.$id : newResource;
        newResource = angular.isObject(newResource) ? newResource : newResource != null ? $injector.get(opts.className).$find(newResource) : null;
        return $firebaseUtils.resolve(oldResourceId === newResourceId).then(function(same) {
          if (same) {
            return $firebaseUtils.reject();
          }
        }).then((function(_this) {
          return function() {
            _this[opts.foreignKey] = newResourceId;
            _this[privateKey(name)] = newResource;
            return association.add(newResource, {
              to: _this
            });
          };
        })(this)).then((function(_this) {
          return function() {
            if (oldResourceId) {
              return reverseAssociation().remove(_this, {
                from: oldResourceId
              });
            }
          };
        })(this)).then((function(_this) {
          return function() {
            if (newResource) {
              return reverseAssociation().add(_this, {
                to: newResource
              });
            }
          };
        })(this)).then((function(_this) {
          return function() {
            return newResource;
          };
        })(this))["catch"](function() {
          return newResource;
        });
      });
      return this._ResourceAdd("create" + (name.camelize(true)), function(data) {
        var klass;
        klass = $injector.get(opts.className);
        return klass.$create(data).then((function(_this) {
          return function(resource) {
            return _this['$set' + name.camelize(true)](resource);
          };
        })(this));
      });
    };

    return AssociationsFactory;

  })();
});

var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

angular.module('angularfire-resource').factory('Collection', function($firebaseArray) {
  var Collection;
  Collection = (function() {
    function Collection(targetClass, ref) {
      this.$$targetClass = targetClass;
      ref || (ref = this.$$targetClass.$ref().ref());
      return $firebaseArray.call(this, ref);
    }

    Collection.prototype.$$added = function(snap) {
      var result;
      result = $firebaseArray.prototype.$$added.apply(this, arguments);
      if (result) {
        return this.$$targetClass.$find(snap.key()).$loaded();
      } else {
        return result;
      }
    };

    Collection.prototype.$next = function(pageSize) {
      if (this.$ref().scroll) {
        return this.$ref().scroll.next(pageSize);
      } else {
        return false;
      }
    };

    return Collection;

  })();
  return $firebaseArray.$extend(Collection);
}).factory('AssociationCollection', function($firebaseArray, $injector, Collection, $firebaseUtils) {
  var AssociationCollection;
  return AssociationCollection = (function(superClass) {
    extend(AssociationCollection, superClass);

    function AssociationCollection(parentRecord, name, opts, cb) {
      var ref;
      this.$$options = opts;
      this.$$targetClass = $injector.get(this.$$options.className);
      this.$parentRecord = parentRecord;
      this.$name = name;
      if (this.$parentRecord) {
        ref = this.$parentRecord.$ref().child(this.$name);
      }
      if (cb != null) {
        ref = cb(ref);
      }
      return $firebaseArray.call(this, ref);
    }

    AssociationCollection.prototype.$create = function(data) {
      return this.$$targetClass.$create(data).then((function(_this) {
        return function(resource) {
          return _this.$add(resource);
        };
      })(this));
    };

    AssociationCollection.prototype.$add = function(resource) {
      var def;
      def = $firebaseUtils.defer();
      this.$ref().child(resource.$id).set(true, $firebaseUtils.makeNodeResolver(def));
      return def.promise.then((function(_this) {
        return function() {
          return resource.constructor._assoc.get(_this.$$options.inverseOf).add(_this.$parentRecord, {
            to: resource
          });
        };
      })(this)).then(function() {
        return resource;
      });
    };

    AssociationCollection.prototype.$remove = function(resource) {
      return $firebaseArray.prototype.$remove.call(this, resource).then((function(_this) {
        return function() {
          return resource.constructor._assoc.get(_this.$$options.inverseOf).remove(_this.$parentRecord, {
            from: resource
          });
        };
      })(this)).then(function() {
        return resource;
      })["catch"]((function(_this) {
        return function() {
          return resource;
        };
      })(this));
    };

    AssociationCollection.prototype.$$notify = function() {
      console.log(this.$parentRecord.constructor.$name.camelize(true), this.$parentRecord.$id, this.$name, arguments);
      return $firebaseArray.prototype.$$notify.apply(this, arguments);
    };

    return AssociationCollection;

  })(Collection);
});

angular.module('angularfire-resource').factory('FireResource', function($firebaseObject, $firebaseUtils, Collection, AssociationFactory) {
  return function(resourceRef, resourceOptions) {
    var Resource;
    if (resourceOptions == null) {
      resourceOptions = {};
    }
    return Resource = (function() {
      var map;

      map = {};

      function Resource(ref) {
        map[ref.key()] = this;
        $firebaseObject.call(this, ref);
      }

      Resource._assoc = new AssociationFactory(Resource);

      Resource.clearMap = function() {
        var instance, key, results;
        results = [];
        for (key in map) {
          instance = map[key];
          results.push(instance.$destroy());
        }
        return results;
      };

      Resource.$name = resourceOptions.name || resourceRef.key().replace(/s$/, '');

      Resource.$query = function(ref) {
        if (typeof ref === 'function') {
          ref = ref(this.$ref());
        }
        return new Collection(Resource, ref);
      };

      Resource.$ref = function() {
        return resourceRef;
      };

      Resource.$create = function(data) {
        var def, ref;
        def = $firebaseUtils.defer();
        ref = Resource.$ref().push();
        ref.set($firebaseUtils.toJSON(data), $firebaseUtils.makeNodeResolver(def));
        return def.promise.then(function() {
          return new Resource(ref).$loaded();
        });
      };

      Resource.$find = function(key) {
        if (map[key]) {
          return map[key];
        } else {
          return new Resource(Resource.$ref().child(key));
        }
      };

      Resource.hasMany = function(name, opts, cb) {
        if (opts == null) {
          opts = {};
        }
        return this._assoc.create('hasMany', name, opts, cb);
      };

      Resource.hasOne = function(name, opts) {
        if (opts == null) {
          opts = {};
        }
        return this._assoc.create('hasOne', name, opts);
      };

      Resource.prototype.$destroy = function() {
        var name, opts, ref1;
        ref1 = this.constructor._assoc.map;
        for (name in ref1) {
          opts = ref1[name];
          if (this['$$' + name] != null) {
            this['$$' + name].$destroy();
          }
        }
        $firebaseObject.prototype.$destroy.apply(this, arguments);
        return delete map[this.$id];
      };

      Resource.prototype.$update = function(data) {
        angular.extend(this, data);
        return this.$save();
      };

      Resource.prototype.$save = function() {
        return $firebaseObject.prototype.$save.apply(this, arguments).then((function(_this) {
          return function() {
            return _this;
          };
        })(this));
      };

      Resource.prototype.$$notify = function() {
        console.log('resource', this.$id, arguments);
        return $firebaseObject.prototype.$$notify.apply(this, arguments);
      };

      $firebaseObject.$extend(Resource);

      return Resource;

    })();
  };
});
