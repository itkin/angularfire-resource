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
  var HasMany, HasOne, ensure_options, getResourceId, privateKey, publicKey, throwError;
  getResourceId = function(resource) {
    if (angular.isObject(resource)) {
      return resource.$id;
    } else {
      return resource;
    }
  };
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
      if (opts[key] == null) {
        throwError(Resource, type, name, key);
      }
    }
    if (type !== 'HasMany' && (opts.foreignKey == null)) {
      throwError(Resource, type, name, 'foreignKey');
    }
    return true;
  };
  HasMany = function(Resource, name, opts, cb) {
    var self;
    if (opts == null) {
      opts = {};
    }
    this.type = 'HasMany';
    this.name = name;
    if (opts.inverseOf !== false) {
      opts.inverseOf || (opts.inverseOf = Resource.$name.replace(/s$/, ''));
    }
    opts.className || (opts.className = name.replace(/s$/, '').camelize(true));
    ensure_options(Resource, this.type, name, opts);
    this.reverseAssociation = function() {
      if (opts.inverseOf) {
        return $injector.get(opts.className)._assoc[opts.inverseOf];
      }
    };
    this.targetClass = function() {
      return $injector.get(opts.className);
    };
    self = this;
    Resource.prototype[publicKey(name)] = function(newCb) {
      if (newCb || !this[privateKey(name)]) {
        if (this[privateKey(name)]) {
          this[privateKey(name)].$destroy();
        }
        return this[privateKey(name)] = new AssociationCollection(self, this, newCb || cb);
      } else {
        return this[privateKey(name)];
      }
    };
    this.remove = function(resource, params) {
      var def;
      def = $firebaseUtils.defer();
      Resource.$ref().child(getResourceId(params.from)).child(name).child(getResourceId(resource)).set(null, $firebaseUtils.makeNodeResolver(def));
      return def.promise.then(function() {
        return resource;
      });
    };
    this.add = function(resource, params) {
      var def, i, key, len, value;
      def = $firebaseUtils.defer();
      if (angular.isArray(opts.storedAt)) {
        value = {};
        for (i = 0, len = opts.length; i < len; i++) {
          key = opts[i];
          value[key] = angular.isFunction(resource[key]) ? resource[key]() : resource[key];
        }
      } else if (angular.isFunction(opts.storedAt)) {
        value = opts.storedAt.call(resource, params.to);
      } else if (angular.isString(opts.storedAt)) {
        value = angular.isFunction(resource[opts.storedAt]) ? resource[opts.storedAt]() : resource[opts.storedAt];
      } else {
        value = true;
      }
      Resource.$ref().child(getResourceId(params.to)).child(name).child(getResourceId(resource)).set(value, $firebaseUtils.makeNodeResolver(def));
      return def.promise.then(function() {
        return resource;
      });
    };
    return this;
  };
  HasOne = function(Resource, name, opts) {
    var association, reverseAssociation;
    if (opts == null) {
      opts = {};
    }
    this.type = 'HasOne';
    this.name = name;
    if (opts.inverseOf !== false) {
      opts.inverseOf || (opts.inverseOf = Resource.$name);
    }
    opts.className || (opts.className = name.camelize(true));
    opts.foreignKey || (opts.foreignKey = name + 'Id');
    ensure_options(Resource, this.type, name, opts);
    angular.extend(this, opts);
    this.targetClass = function() {
      return $injector.get(this.className);
    };
    reverseAssociation = function() {
      if (opts.inverseOf) {
        return $injector.get(opts.className)._assoc[opts.inverseOf];
      }
    };
    this.remove = function(resource, params) {
      var def;
      def = $firebaseUtils.defer();
      Resource.$ref().child(getResourceId(params.from)).child(opts.foreignKey).once('value', function(snap) {
        if (snap.val() !== resource.$id) {
          return snap.ref().set(null, $firebaseUtils.makeNodeResolver(def));
        }
      });
      return def.promise.then(function() {
        return resource;
      });
    };
    this.add = function(resource, params) {
      var def;
      def = $firebaseUtils.defer();
      Resource.$ref().child(getResourceId(params.to)).child(opts.foreignKey).set(getResourceId(resource), $firebaseUtils.makeNodeResolver(def));
      return def.promise.then(function() {
        return resource;
      });
    };
    association = this;
    Resource.prototype[publicKey(name)] = function() {
      var klass, name1;
      klass = $injector.get(opts.className);
      if (this[opts.foreignKey] != null) {
        return this[name1 = privateKey(name)] || (this[name1] = klass.$find(this[opts.foreignKey]));
      } else {
        return null;
      }
    };
    Resource.prototype[publicKey("create" + (name.camelize(true)))] = function(data) {
      var klass;
      klass = $injector.get(opts.className);
      return klass.$create(data).then((function(_this) {
        return function(resource) {
          return _this[publicKey("set" + (name.camelize(true)))](resource);
        };
      })(this));
    };
    Resource.prototype[publicKey("set" + (name.camelize(true)))] = function(newResource) {
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
          if (oldResourceId && reverseAssociation()) {
            return reverseAssociation().remove(_this, {
              from: oldResourceId
            });
          }
        };
      })(this)).then((function(_this) {
        return function() {
          if (newResource && reverseAssociation()) {
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
    };
    return this;
  };
  return {
    HasOne: HasOne,
    HasMany: HasMany
  };
});

var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

angular.module('angularfire-resource').factory('Collection', function($firebaseArray, $firebaseUtils) {
  var Collection;
  Collection = (function() {
    function Collection(targetClass, cb) {
      this.$$targetClass = targetClass;
      this.$$init(this.$$targetClass.$ref(), cb);
      return this.$list;
    }

    Collection.prototype.$$init = function(baseRef, cb) {
      var init, self;
      self = this;
      init = function(ref) {
        $firebaseArray.call(self, ref);
        return self;
      };
      if (cb != null) {
        return cb.call(this, baseRef, init);
      } else {
        return init(baseRef);
      }
    };

    Collection.prototype.$loaded = function() {
      return $firebaseArray.prototype.$loaded.apply(this, arguments).then((function(_this) {
        return function() {
          var i, item, itemsPromises, len, ref1;
          itemsPromises = [];
          ref1 = _this.$list;
          for (i = 0, len = ref1.length; i < len; i++) {
            item = ref1[i];
            itemsPromises.push(item.$loaded());
          }
          return $firebaseUtils.allPromises(itemsPromises);
        };
      })(this));
    };

    Collection.prototype.$include = function(includes) {
      this.$loaded().then((function(_this) {
        return function() {
          var i, instance, len, ref1, results;
          _this.$$includes = includes;
          ref1 = _this.$list;
          results = [];
          for (i = 0, len = ref1.length; i < len; i++) {
            instance = ref1[i];
            results.push(instance.$include(_this.$$includes));
          }
          return results;
        };
      })(this));
      return this;
    };

    Collection.prototype.$$added = function(snap) {
      var result;
      result = $firebaseArray.prototype.$$added.apply(this, arguments);
      if (result) {
        return this.$$targetClass.$find(snap.key()).$include(this.$$includes);
      } else {
        return result;
      }
    };

    Collection.prototype.$$updated = function(snap) {
      return false;
    };

    Collection.prototype.$next = function(pageSize) {
      var def;
      if (this.$ref().scroll) {
        def = $firebaseUtils.defer();
        if (this.$ref().scroll.hasNext()) {
          this.$ref().once('value', (function(_this) {
            return function() {
              return _this.$loaded().then(function() {
                return def.resolve(_this);
              });
            };
          })(this));
          this.$ref().scroll.next(pageSize);
        } else {
          def.resolve(this);
        }
        return def.promise;
      } else {
        return false;
      }
    };

    Collection.prototype.$prev = function(pageSize) {
      if (this.$ref().scroll) {
        this.$ref().scroll.prev(pageSize);
        return this.$loaded();
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

    function AssociationCollection(association, parentRecord, cb) {
      var ref;
      this.$$association = association;
      this.$$targetClass = association.targetClass();
      this.$$parentRecord = parentRecord;
      if (this.$$parentRecord.$isNew()) {
        throw "Association Error : parent instance should be saved";
      }
      ref = this.$$parentRecord.$ref().child(this.$$association.name);
      this.$$init(ref, cb);
      return this.$list;
    }

    AssociationCollection.prototype.$create = function(data) {
      return this.$$association.targetClass().$create(data).then((function(_this) {
        return function(resource) {
          return _this.$add(resource);
        };
      })(this));
    };

    AssociationCollection.prototype.$add = function(resource) {
      return $firebaseUtils.resolve(resource.$isNew() ? resource.$save() : void 0).then((function(_this) {
        return function() {
          if (_this.$indexFor(resource.$id) !== -1) {
            return $firebaseUtils.reject();
          }
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.$$association.add(resource, {
            to: _this.$$parentRecord
          });
        };
      })(this)).then((function(_this) {
        return function(resource) {
          if (_this.$$association.reverseAssociation()) {
            return _this.$$association.reverseAssociation().add(_this.$$parentRecord, {
              to: resource
            });
          }
        };
      })(this))["catch"](function() {
        return console.log("resource allready in the collection");
      }).then(function() {
        return resource;
      });
    };

    AssociationCollection.prototype.$remove = function(resource) {
      return $firebaseArray.prototype.$remove.call(this, resource).then((function(_this) {
        return function() {
          if (_this.$$association.reverseAssociation()) {
            return _this.$$association.reverseAssociation().remove(_this.$$parentRecord, {
              from: resource
            });
          }
        };
      })(this))["catch"]((function(_this) {
        return function() {
          return console.log(_this.$$association.name.camelize(true), _this.$$parentRecord.$id, _this.$$association.name, arguments);
        };
      })(this)).then(function() {
        return resource;
      });
    };

    AssociationCollection.prototype.$$notify = function() {
      console.log(this.$$parentRecord.constructor.$name.camelize(true), this.$$parentRecord.$id, this.$$association.name, arguments[0], arguments[1]);
      return $firebaseArray.prototype.$$notify.apply(this, arguments);
    };

    return AssociationCollection;

  })(Collection);
});

angular.module('angularfire-resource').factory('FireResource', function($firebaseObject, $firebaseUtils, Collection, AssociationFactory) {
  return function(resourceRef, resourceOptions, callback) {
    var Resource;
    if (resourceOptions == null) {
      resourceOptions = {};
    }
    if (angular.isFunction(resourceOptions)) {
      callback = resourceOptions;
      resourceOptions = {};
    }
    return Resource = (function() {
      var cbName, fn, i, len, map, ref1;

      map = {};

      function Resource(ref) {
        map[ref.key()] = this;
        $firebaseObject.call(this, ref);
        this.$$isNew = false;
        this.$$loaded = false;
        this.$$setIncludes(resourceOptions.include);
        this.$loaded();
      }

      Resource._assoc = {};

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

      Resource.$query = function(cb) {
        return new Collection(Resource, cb);
      };

      Resource.$ref = function() {
        return resourceRef;
      };

      Resource.$new = function(data) {
        var instance;
        if (data == null) {
          data = {};
        }
        instance = new this(this.$ref().push());
        instance.$$isNew = true;
        angular.extend(instance, data);
        return instance;
      };

      Resource.$create = function(data) {
        if (data == null) {
          data = {};
        }
        return this.$new(data).$save();
      };

      Resource.$find = function(key, opts) {
        var inst;
        if (opts == null) {
          opts = {};
        }
        if (map[key]) {
          inst = map[key];
        } else {
          inst = new Resource(Resource.$ref().child(key));
        }
        if (opts.includes != null) {
          inst.$includes(opts.includes);
        }
        return inst;
      };

      Resource.hasMany = function(name, opts, cb) {
        if (opts == null) {
          opts = {};
        }
        this._assoc[name] = new AssociationFactory.HasMany(this, name, opts, cb);
        return this;
      };

      Resource.hasOne = function(name, opts) {
        if (opts == null) {
          opts = {};
        }
        this._assoc[name] = new AssociationFactory.HasOne(this, name, opts);
        return this;
      };

      ref1 = ['beforeCreate', 'beforeSave', 'afterSave', 'afterCreate'];
      fn = function(cbName) {
        Resource['_' + cbName] = [];
        return Resource[cbName] = function(cb) {
          Resource['_' + cbName].push(cb);
          return this;
        };
      };
      for (i = 0, len = ref1.length; i < len; i++) {
        cbName = ref1[i];
        fn(cbName);
      }

      Resource.prototype.$isNew = function() {
        return this.$$isNew;
      };

      Resource.prototype.$loaded = function() {
        return $firebaseObject.prototype.$loaded.apply(this, arguments).then((function(_this) {
          return function() {
            return _this.$$loadIncludes();
          };
        })(this)).then((function(_this) {
          return function() {
            _this.$$loaded = true;
            return _this;
          };
        })(this));
      };

      Resource.prototype.$$loadIncludes = function() {
        var name, opts, promises, ref2;
        promises = [];
        ref2 = this.$$includes;
        for (name in ref2) {
          opts = ref2[name];
          if (opts === true) {
            promises.push(this["$" + name]().$loaded());
          } else {
            promises.push(this["$" + name](opts).$loaded());
          }
        }
        return $firebaseUtils.allPromises(promises);
      };

      Resource.prototype.$$setIncludes = function(includes) {
        var include, j, len1, results;
        this.$$includes || (this.$$includes = {});
        if (angular.isString(includes)) {
          return this.$$includes[includes] = true;
        } else if (angular.isArray(includes)) {
          results = [];
          for (j = 0, len1 = includes.length; j < len1; j++) {
            include = includes[j];
            results.push(this.$$setIncludes(include));
          }
          return results;
        } else if (angular.isObject(includes)) {
          return angular.extend(this.$$includes, includes);
        }
      };

      Resource.prototype.$include = function(includes) {
        this.$$setIncludes(includes);
        this.$loaded();
        return this;
      };

      Resource.prototype.$destroy = function() {
        var assoc, name, ref2;
        ref2 = this.constructor._assoc;
        for (name in ref2) {
          assoc = ref2[name];
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

      Resource.prototype.$$updated = function(snap) {
        var assoc, name, old, ref2, result;
        if (this.$$isNew && snap.val()) {
          this.$$isNew = false;
        }
        old = $firebaseUtils.toJSON(this);
        result = $firebaseObject.prototype.$$updated.apply(this, arguments);
        ref2 = this.constructor._assoc;
        for (name in ref2) {
          assoc = ref2[name];
          if (assoc.type === 'HasOne' && (this["$$" + name] != null) && this[assoc.foreignKey] !== old[assoc.foreignKey]) {
            this["$$" + name] = null;
            this["$" + name]();
          }
        }
        return result;
      };

      Resource.prototype.$save = function() {
        return $firebaseUtils.resolve().then((function(_this) {
          return function() {
            if (_this.$isNew()) {
              return _this.$$runCallbacks('beforeCreate');
            }
          };
        })(this)).then((function(_this) {
          return function() {
            return _this.$$runCallbacks('beforeSave');
          };
        })(this)).then((function(_this) {
          return function() {
            if (_this.$isNew()) {
              _this.createdAt = Firebase.ServerValue.TIMESTAMP;
            }
            return _this.updatedAt = Firebase.ServerValue.TIMESTAMP;
          };
        })(this)).then((function(_this) {
          return function() {
            return $firebaseObject.prototype.$save.apply(_this, arguments);
          };
        })(this)).then((function(_this) {
          return function() {
            if (_this.$isNew()) {
              return _this.$$runCallbacks('afterCreate');
            }
          };
        })(this)).then((function(_this) {
          return function() {
            return _this.$$runCallbacks('afterSave');
          };
        })(this)).then((function(_this) {
          return function() {
            return _this;
          };
        })(this));
      };

      Resource.prototype.$$runCallbacks = function(name) {
        var cb, j, len1, promise, ref2;
        promise = $firebaseUtils.resolve();
        ref2 = this.constructor['_' + name];
        for (j = 0, len1 = ref2.length; j < len1; j++) {
          cb = ref2[j];
          if (angular.isString(cb)) {
            cb = this[cb];
          }
          promise = promise.then((function(_this) {
            return function() {
              return cb.call(_this);
            };
          })(this));
        }
        return promise;
      };

      Resource.prototype.$$notify = function() {
        console.log(this.constructor.$name.camelize(true), this.$id, "updated");
        return $firebaseObject.prototype.$$notify.apply(this, arguments);
      };

      $firebaseObject.$extend(Resource);

      if (callback != null) {
        callback.call(Resource);
      }

      Resource;

      return Resource;

    })();
  };
});
