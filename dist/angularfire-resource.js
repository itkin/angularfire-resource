angular.module('angularfire-resource', []).factory('utils', function() {
  return {
    toCamelCase: function(name) {
      return name.replace(/(-|\s)(\w)/g, function(match) {
        return match[1].toUpperCase();
      });
    }
  };
});

angular.module('angularfire-resource').factory('fireCollection', function($firebaseArray, $injector, $firebaseUtils, $q, utils) {
  var Collection;
  return Collection = (function() {
    function Collection(opts, cb) {
      var ref;
      this._opts = opts;
      this._parentRecord = this._opts.parentRecord;
      this._targetClass = $injector.get(this._opts.className);
      ref = this._parentRecord.$ref().child(this._opts.name);
      if (cb != null) {
        ref = cb(ref);
      }
      return $firebaseArray.call(this, ref);
    }

    Collection.prototype.$next = function(pageSize) {
      if (this.$ref().scroll) {
        return this.$ref().scroll.next(pageSize);
      } else {
        return false;
      }
    };

    Collection.prototype.$create = function(data) {
      return this._targetClass.$create(data).then((function(_this) {
        return function(resource) {
          return _this.$add(resource);
        };
      })(this));
    };

    Collection.prototype.$add = function(resource) {
      var def;
      if (this.$indexFor(resource.$id) !== -1) {
        return $firebaseUtils.resolve();
      } else {
        def = $firebaseUtils.defer();
        this.$ref().child(resource.$id).set(true, $firebaseUtils.makeNodeResolver(def));
        return def.promise.then((function(_this) {
          return function() {
            return _this._setInverseAssociation(resource);
          };
        })(this));
      }
    };

    Collection.prototype._setInverseAssociation = function(resource) {
      return resource[utils.toCamelCase('$set-' + this._opts.inverseOf)].call(resource, this._parentRecord);
    };

    Collection.prototype.$$added = function(snap) {
      var result;
      result = $firebaseArray.prototype.$$added.apply(this, arguments);
      if (result) {
        return this._targetClass.$find(snap.key()).$loaded();
      } else {
        return result;
      }
    };

    Collection.prototype.$destroy = function() {
      var i, item, len, ref1;
      ref1 = this.$list;
      for (i = 0, len = ref1.length; i < len; i++) {
        item = ref1[i];
        item.$destroy();
      }
      return $firebaseArray.prototype.$destroy.apply(this, arguments);
    };

    Collection.prototype.$$notify = function() {
      console.log('collection', arguments);
      return $firebaseArray.prototype.$$notify.apply(this, arguments);
    };

    $firebaseArray.$extend(Collection);

    return Collection;

  })();
});

angular.module('angularfire-resource').factory('fireResource', function($firebaseObject, fireCollection, $firebaseUtils, $injector, utils) {
  var RelConfig;
  RelConfig = (function() {
    function RelConfig() {
      this._map = {};
    }

    RelConfig.prototype.add = function(type, name, opts) {
      return this._map[name] = angular.extend({
        name: name,
        type: type
      }, opts);
    };

    RelConfig.prototype.findInverseOf = function(name) {
      var assoc, key, opts, ref1;
      assoc = null;
      ref1 = this._map;
      for (key in ref1) {
        opts = ref1[key];
        if (opts.inverseOf === name) {
          assoc = opts;
          break;
        }
      }
      return assoc;
    };

    return RelConfig;

  })();
  return function(resourceRef, resourceOptions) {
    var Resource;
    if (resourceOptions == null) {
      resourceOptions = {};
    }
    resourceOptions.hasMany || (resourceOptions.hasMany = {});
    resourceOptions.name || (resourceOptions.name = resourceRef.key().replace(/s$/, ''));
    return Resource = (function() {
      function Resource(ref) {
        return $firebaseObject.call(this, ref);
      }

      Resource._relations = new RelConfig();

      Resource._name = resourceOptions.name;

      Resource._foreignKey = Resource._name + 'Id';

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
        return new Resource(Resource.$ref().child(key));
      };

      Resource.hasMany = function(name, opts, cb) {
        if (opts == null) {
          opts = {};
        }
        this._relations.add('hasMany', name, opts);
        return Resource.prototype['$' + name] = function(updateRef) {
          if (updateRef || !this['$$' + name]) {
            if (this['$$' + name]) {
              this['$$' + name].$destroy();
            }
            return this['$$' + name] = new fireCollection(angular.extend({}, opts, {
              parentRecord: this,
              name: name
            }), updateRef || cb);
          } else {
            return this['$$' + name];
          }
        };
      };

      Resource.hasOne = function(name, opts) {
        if (opts == null) {
          opts = {};
        }
        this._relations.add('hasOne', name, opts);
        Resource.prototype['$' + name] = function() {
          var klass, name1;
          klass = $injector.get(opts.className);
          if (this[opts._foreignKey]) {
            return this[name1 = '$$' + name] || (this[name1] = new klass(klass.$ref().child(this[opts._foreignKey])));
          } else {
            return null;
          }
        };
        Resource.prototype['$' + utils.toCamelCase("create-" + name)] = function(data) {
          var klass;
          klass = $injector.get(opts.className);
          return klass.$create(data).then((function(_this) {
            return function(resource) {
              return _this['$' + utils.toCamelCase("set-" + name)](resource);
            };
          })(this));
        };
        return Resource.prototype['$' + utils.toCamelCase("set-" + name)] = function(resource) {
          var def;
          if (this[opts.foreignKey] === resource.$id) {
            return $firebaseUtils.resolve();
          } else {
            def = $firebaseUtils.defer();
            this.$ref().child(opts.foreignKey).set(resource.$id, $firebaseUtils.makeNodeResolver(def));
            return def.promise.then((function(_this) {
              return function() {
                var klass;
                klass = $injector.get(opts.className);
                return resource[utils.toCamelCase('$set-' + klass._relations.findInverseOf(name).name)](_this);
              };
            })(this));
          }
        };
      };

      Resource.belongsTo = function(name, opts) {
        if (opts == null) {
          opts = {};
        }
        this._relations.add('belongsTo', name, opts);
        return Resource.prototype["$" + utils.toCamelCase("set-" + name)] = function(resource) {
          var def;
          if (this[opts.foreignKey] === resource.$id) {
            return $firebaseUtils.resolve();
          } else {
            def = $firebaseUtils.defer();
            this.$ref().child(opts.foreignKey).set(resource.$id, $firebaseUtils.makeNodeResolver(def));
            return def.promise.then((function(_this) {
              return function() {
                return resource["$" + opts.inverseOf]().$add(_this);
              };
            })(this));
          }
        };
      };

      Resource.prototype.$destroy = function() {
        var key, params, ref1;
        ref1 = resourceOptions.hasMany;
        for (key in ref1) {
          params = ref1[key];
          if (this['$$' + key] != null) {
            this['$$' + key].$destroy();
          }
        }
        return $firebaseObject.prototype.$destroy.apply(this, arguments);
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
