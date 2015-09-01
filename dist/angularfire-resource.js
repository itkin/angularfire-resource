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
    this.$$conf = angular.extend({
      name: name
    }, opts);
    this.reverseAssociation = function() {
      if (opts.inverseOf) {
        return $injector.get(opts.className)._assoc[opts.inverseOf];
      }
    };
    self = this;
    Resource.prototype[publicKey(name)] = function(updateRef) {
      if (updateRef || !this[privateKey(name)]) {
        if (this[privateKey(name)]) {
          this[privateKey(name)].$destroy();
        }
        return this[privateKey(name)] = new AssociationCollection(this, self, opts, updateRef || cb);
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
    this.$$conf = angular.extend({
      name: name
    }, opts);
    reverseAssociation = function() {
      if (opts.inverseOf) {
        return $injector.get(opts.className)._assoc[opts.inverseOf];
      }
    };
    association = this;
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

angular.module('angularfire-resource').factory('Collection', function($firebaseArray, $firebaseUtils, $timeout) {
  var Collection;
  Collection = (function() {
    function Collection(targetClass, ref) {
      this.$$targetClass = targetClass;
      ref || (ref = this.$$targetClass.$ref().ref());
      return $firebaseArray.call(this, ref);
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

    Collection.prototype.$$added = function(snap) {
      var result;
      result = $firebaseArray.prototype.$$added.apply(this, arguments);
      if (result) {
        return this.$$targetClass.$find(snap.key());
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
                return def.resolve();
              });
            };
          })(this));
          this.$ref().scroll.next(pageSize);
        } else {
          def.resolve();
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

    function AssociationCollection(parentRecord, association, opts, cb) {
      var ref;
      this.$$options = opts;
      this.$$targetClass = $injector.get(this.$$options.className);
      this.$$association = association;
      this.$parentRecord = parentRecord;
      if (this.$parentRecord) {
        ref = this.$parentRecord.$ref().child(this.$$association.name);
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
      return this.$$association.add(resource, {
        to: this.$parentRecord
      }).then((function(_this) {
        return function(resource) {
          if (_this.$$association.reverseAssociation()) {
            return _this.$$association.reverseAssociation().add(_this.$parentRecord, {
              to: resource
            });
          }
        };
      })(this)).then(function() {
        return resource;
      });
    };

    AssociationCollection.prototype.$remove = function(resource) {
      return $firebaseArray.prototype.$remove.call(this, resource).then((function(_this) {
        return function() {
          if (_this.$$association.reverseAssociation()) {
            return _this.$$association.reverseAssociation().remove(_this.$parentRecord, {
              from: resource
            });
          }
        };
      })(this)).then(function() {
        return resource;
      })["catch"]((function(_this) {
        return function() {
          console.log(_this.$$association.name.camelize(true), _this.$parentRecord.$id, _this.$$association.name, arguments);
          return resource;
        };
      })(this));
    };

    AssociationCollection.prototype.$$notify = function() {
      console.log(this.$parentRecord.constructor.$name.camelize(true), this.$parentRecord.$id, this.$$association.name, arguments[0], arguments[1]);
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
      var i, len, map, name, ref1;

      map = {};

      function Resource(ref) {
        map[ref.key()] = this;
        $firebaseObject.call(this, ref);
        this.$$isNew = false;
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

      Resource.$query = function(ref) {
        if (typeof ref === 'function') {
          ref = ref(this.$ref());
        }
        return new Collection(Resource, ref);
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
      for (i = 0, len = ref1.length; i < len; i++) {
        name = ref1[i];
        Resource.prototype['$$' + name] = [];
        Resource[name] = function(cb) {
          this.prototype['$$' + name].push(cb);
          return this;
        };
      }

      Resource.prototype.$isNew = function() {
        return this.$$isNew;
      };

      Resource.prototype.$loaded = function() {
        return $firebaseObject.prototype.$loaded.apply(this, arguments).then((function(_this) {
          return function() {
            _this.$$loaded = true;
            return _this;
          };
        })(this));
      };

      Resource.prototype.$destroy = function() {
        var assoc, ref2;
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
        var assoc, old, ref2, result;
        old = $firebaseUtils.toJSON(this);
        result = $firebaseObject.prototype.$$updated.apply(this, arguments);
        ref2 = this.constructor._assoc;
        for (name in ref2) {
          assoc = ref2[name];
          if (assoc.type === 'HasOne' && (this["$$" + name] != null) && this[assoc.$$conf.foreignKey] !== old[assoc.$$conf.foreignKey]) {
            this["$$" + name] = null;
            this["$" + name]();
          }
        }
        return result;
      };

      Resource.prototype.$save = function() {
        if (this.$isNew()) {
          this.$$runCallbacks('beforeCreate');
        }
        this.$$runCallbacks('beforeSave');
        if (this.$isNew()) {
          this.createdAt = Firebase.ServerValue.TIMESTAMP;
        }
        this.updatedAt = Firebase.ServerValue.TIMESTAMP;
        return $firebaseObject.prototype.$save.apply(this, arguments).then((function(_this) {
          return function() {
            _this.$$isNew = false;
            if (_this.$isNew()) {
              _this.$$runCallbacks('afterCreate');
            }
            return _this.$$runCallbacks('afterSave');
          };
        })(this)).then((function(_this) {
          return function() {
            return _this;
          };
        })(this));
      };

      Resource.prototype.$$runCallbacks = function(name) {
        var cb, j, len1, ref2, results;
        ref2 = this['$$' + name];
        results = [];
        for (j = 0, len1 = ref2.length; j < len1; j++) {
          cb = ref2[j];
          if (angular.isFunction(cb)) {
            results.push(cb.call(this, this));
          } else if (angular.isString(cb)) {
            results.push(this[cb].call(this));
          } else {
            results.push(void 0);
          }
        }
        return results;
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
