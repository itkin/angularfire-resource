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

var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

angular.module('angularfire-resource').factory('AssociationFactory', [
  '$injector', '$firebaseUtils', 'AssociationCollection', function($injector, $firebaseUtils, AssociationCollection) {
    var Association, HasMany, HasOne, ensure_options, getResourceId, privateKey, publicKey, throwError;
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
    Association = (function() {
      function Association() {}

      Association.prototype.reverseAssociation = function() {
        if (this.inverseOf) {
          return this.targetClass()._assoc[this.inverseOf];
        }
      };

      Association.prototype.targetClass = function() {
        return $injector.get(this.className);
      };

      Association.prototype.remove = function() {};

      Association.prototype.add = function() {};

      return Association;

    })();
    HasMany = (function(superClass) {
      extend(HasMany, superClass);

      function HasMany(Resource, name, opts, cb) {
        var self;
        if (opts == null) {
          opts = {};
        }
        this.Resource = Resource;
        this.type = 'HasMany';
        this.name = name;
        self = this;
        if (opts.inverseOf !== false) {
          opts.inverseOf || (opts.inverseOf = this.Resource.$name.replace(/s$/, ''));
        }
        opts.className || (opts.className = name.replace(/s$/, '').camelize(true));
        ensure_options(this.Resource, this.type, name, opts);
        angular.extend(this, opts);
        this.Resource.prototype[publicKey(name)] = function(newCb) {
          if (newCb || !this[privateKey(name)]) {
            if (this[privateKey(name)]) {
              this[privateKey(name)].$destroy();
            }
            return this[privateKey(name)] = new AssociationCollection(self, this, newCb || cb);
          } else {
            return this[privateKey(name)];
          }
        };
      }

      HasMany.prototype.remove = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        this.Resource.$ref().child(getResourceId(params.from)).child(name).child(getResourceId(resource)).set(null, $firebaseUtils.makeNodeResolver(def));
        return def.promise.then(function() {
          return resource;
        });
      };

      HasMany.prototype.add = function(resource, params) {
        var def, getValue;
        def = $firebaseUtils.defer();
        getValue = function(storedAt, parent, child) {
          var i, key, len, value;
          if (angular.isArray(storedAt)) {
            value = {};
            for (i = 0, len = storedAt.length; i < len; i++) {
              key = storedAt[i];
              value[key] = getValue(key, parent, child);
            }
            return value;
          } else if (angular.isFunction(storedAt)) {
            return storedAt.call(parent, child);
          } else if (angular.isString(storedAt)) {
            if (angular.isFunction(child[storedAt])) {
              return child[storedAt](parent);
            } else {
              return child[storedAt];
            }
          } else {
            return true;
          }
        };
        this.Resource.$ref().child(getResourceId(params.to)).child(this.name).child(getResourceId(resource)).set(getValue(this.storedAt, params.to, resource), $firebaseUtils.makeNodeResolver(def));
        return def.promise.then(function() {
          return resource;
        });
      };

      return HasMany;

    })(Association);
    HasOne = (function(superClass) {
      extend(HasOne, superClass);

      function HasOne(Resource, name, opts) {
        var self;
        if (opts == null) {
          opts = {};
        }
        this.Resource = Resource;
        this.type = 'HasOne';
        this.name = name;
        if (opts.inverseOf !== false) {
          opts.inverseOf || (opts.inverseOf = Resource.$name);
        }
        opts.className || (opts.className = name.camelize(true));
        opts.foreignKey || (opts.foreignKey = name + 'Id');
        ensure_options(Resource, this.type, name, opts);
        angular.extend(this, opts);
        self = this;
        Resource.prototype[publicKey(name)] = function() {
          var name1;
          if (this[self.foreignKey] != null) {
            return this[name1 = privateKey(name)] || (this[name1] = self.targetClass().$find(this[self.foreignKey]));
          } else {
            return null;
          }
        };
        Resource.prototype[publicKey("create" + (name.camelize(true)))] = function(data) {
          return self.targetClass().$create(data).then((function(_this) {
            return function(resource) {
              return _this[publicKey("set" + (name.camelize(true)))](resource);
            };
          })(this));
        };
        Resource.prototype[publicKey("set" + (name.camelize(true)))] = function(newResource) {
          var newResourceId, oldResourceId;
          oldResourceId = this[self.foreignKey];
          newResourceId = angular.isObject(newResource) ? newResource.$id : newResource;
          newResource = angular.isObject(newResource) ? newResource : newResource != null ? self.targetClass().$find(newResource) : null;
          return $firebaseUtils.resolve(oldResourceId === newResourceId).then(function(same) {
            if (same) {
              return $firebaseUtils.reject();
            }
          }).then((function(_this) {
            return function() {
              _this[self.foreignKey] = newResourceId;
              _this[privateKey(name)] = newResource;
              return self.add(newResource, {
                to: _this
              });
            };
          })(this)).then((function(_this) {
            return function() {
              if (oldResourceId && self.reverseAssociation()) {
                return self.reverseAssociation().remove(_this, {
                  from: oldResourceId
                });
              }
            };
          })(this)).then((function(_this) {
            return function() {
              if (newResource && self.reverseAssociation()) {
                return self.reverseAssociation().add(_this, {
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
      }

      HasOne.prototype.remove = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        this.Resource.$ref().child(getResourceId(params.from)).child(this.foreignKey).once('value', function(snap) {
          if (snap.val() !== resource.$id) {
            return snap.ref().set(null, $firebaseUtils.makeNodeResolver(def));
          }
        });
        return def.promise.then(function() {
          return resource;
        });
      };

      HasOne.prototype.add = function(resource, params) {
        var def;
        def = $firebaseUtils.defer();
        this.Resource.$ref().child(getResourceId(params.to)).child(this.foreignKey).set(getResourceId(resource), $firebaseUtils.makeNodeResolver(def));
        return def.promise.then(function() {
          return resource;
        });
      };

      return HasOne;

    })(Association);
    return {
      HasOne: HasOne,
      HasMany: HasMany
    };
  }
]);

var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

angular.module('angularfire-resource').factory('Collection', [
  '$firebaseArray', '$firebaseUtils', function($firebaseArray, $firebaseUtils) {
    var Collection;
    Collection = (function() {
      function Collection(targetClass, cb) {
        this.$$targetClass = targetClass;
        this.$$init(this.$$targetClass.$ref(), cb);
        return this.$list;
      }

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
        var def;
        if (this.$ref().scroll) {
          def = $firebaseUtils.defer();
          if (this.$ref().scroll.hasPrev()) {
            this.$ref().once('value', (function(_this) {
              return function() {
                return _this.$loaded().then(function() {
                  return def.resolve(_this);
                });
              };
            })(this));
            this.$ref().scroll.prev(pageSize);
          } else {
            def.resolve(this);
          }
          return def.promise;
        } else {
          return false;
        }
      };

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

      return Collection;

    })();
    return $firebaseArray.$extend(Collection);
  }
]).factory('AssociationCollection', [
  '$firebaseArray', '$injector', 'Collection', '$firebaseUtils', function($firebaseArray, $injector, Collection, $firebaseUtils) {
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

      return AssociationCollection;

    })(Collection);
  }
]);

angular.module('angularfire-resource').factory('FireResource', [
  '$firebaseObject', '$firebaseUtils', 'Collection', 'AssociationFactory', function($firebaseObject, $firebaseUtils, Collection, AssociationFactory) {
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
          this.$include(resourceOptions.includes);
        }

        Resource._assoc = {};

        Resource.$name = resourceOptions.name || resourceRef.key().replace(/s$/, '');

        Resource.$ref = function() {
          return resourceRef;
        };

        Resource.$query = function(cb) {
          return new Collection(Resource, cb);
        };

        Resource.$new = function(data) {
          var instance;
          if (data == null) {
            data = {};
          }
          if (data.id != null) {
            instance = new this(this.$ref().child(data.id));
            delete data.id;
          } else {
            instance = new this(this.$ref().push());
          }
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

        Resource.clearMap = function() {
          var instance, key, results;
          results = [];
          for (key in map) {
            instance = map[key];
            results.push(instance.$destroy());
          }
          return results;
        };

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

        Resource.prototype.$save = function() {
          var args, isNew, self;
          args = arguments;
          isNew = this.$isNew();
          self = this;
          return $firebaseUtils.resolve().then(function() {
            if (isNew) {
              return self.$$runCallbacks('beforeCreate');
            }
          }).then(function() {
            return self.$$runCallbacks('beforeSave');
          }).then(function() {
            if (isNew) {
              self.createdAt = Firebase.ServerValue.TIMESTAMP;
            }
            return self.updatedAt = Firebase.ServerValue.TIMESTAMP;
          }).then(function() {
            return $firebaseObject.prototype.$save.apply(self, args);
          }).then(function() {
            if (isNew) {
              return self.$$runCallbacks('afterCreate');
            }
          }).then(function() {
            return self.$$runCallbacks('afterSave');
          }).then(function() {
            return self;
          });
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

        Resource.prototype.$$runCallbacks = function(name) {
          var cb, fn1, j, len1, promise, ref2, self;
          promise = $firebaseUtils.resolve();
          self = this;
          ref2 = this.constructor['_' + name];
          fn1 = function(cb) {
            return promise = promise.then(function() {
              return cb.apply(self, [self]);
            });
          };
          for (j = 0, len1 = ref2.length; j < len1; j++) {
            cb = ref2[j];
            if (angular.isString(cb)) {
              cb = this[cb];
            }
            fn1(cb);
          }
          return promise;
        };

        $firebaseObject.$extend(Resource);

        if (callback != null) {
          callback.call(Resource);
        }

        Resource;

        return Resource;

      })();
    };
  }
]);
