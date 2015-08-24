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

angular.module('angularfire-resource').factory('AssociationFactory', function($injector, $firebaseUtils) {
  var AssociationsFactory;
  return AssociationsFactory = (function() {
    var ensure_options, privateKey, publicKey, setAttrIfDifferent, throwError;

    publicKey = function(name) {
      return '$' + name;
    };

    privateKey = function(name) {
      return '$$' + name;
    };

    setAttrIfDifferent = function(attr, value, cb) {
      var def;
      if (this[attr] === value) {
        return $firebaseUtils.resolve();
      } else {
        def = $firebaseUtils.defer();
        this.$ref().child(attr).set(value, $firebaseUtils.makeNodeResolver(def));
        if (cb) {
          def = def.promise.then(cb);
        }
        return def;
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
      return this['create' + type.camelize(true)](name, opts, cb);
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

    AssociationsFactory.prototype.createHasMany = function(name, opts, cb) {
      return this.Resource.prototype[publicKey(name)] = function(updateRef) {
        if (updateRef || !this[privateKey(name)]) {
          if (this[privateKey(name)]) {
            this[privateKey(name)].$destroy();
          }
          return this[privateKey(name)] = new fireCollection(this, name, opts, updateRef || cb);
        } else {
          return this[privateKey(name)];
        }
      };
    };

    AssociationsFactory.prototype.createHasOne = function(name, opts) {
      this.Resource.prototype[publicKey(name)] = function() {
        var klass, name1;
        klass = $injector.get(opts.className);
        if (this[opts.foreignKey]) {
          return this[name1 = privateKey(name)] || (this[name1] = new klass(klass.$ref().child(this[opts.foreignKey])));
        } else {
          return null;
        }
      };
      this.Resource.prototype[publicKey('create' + name.camelize(true))] = function(data) {
        var klass;
        klass = $injector.get(opts.className);
        return klass.$create(data).then((function(_this) {
          return function(resource) {
            return _this[publicKey('set' + name.camelize(true))](resource);
          };
        })(this));
      };
      return this.Resource.prototype[publicKey('set' + name.camelize(true))] = function(resource) {
        return setAttrIfDifferent.call(this, opts.foreignKey, resource.$id, (function(_this) {
          return function() {
            var klass, reverseSetter;
            klass = $injector.get(opts.className);
            reverseSetter = publicKey('set' + klass._assoc.inverseOf(name).name.camelize(true));
            return resource[reverseSetter](_this);
          };
        })(this));
      };
    };

    AssociationsFactory.prototype.createBelongsTo = function(name, opts) {
      return this.Resource.prototype[publicKey("set" + (name.camelize(true)))] = function(resource) {
        return setAttrIfDifferent.call(this, opts.foreignKey, resource.$id, (function(_this) {
          return function() {
            return resource[publicKey(opts.inverseOf)]().$add(_this);
          };
        })(this));
      };
    };

    return AssociationsFactory;

  })();
});

angular.module('angularfire-resource').factory('fireCollection', function($firebaseArray, $injector, $firebaseUtils) {
  var Collection;
  return Collection = (function() {
    function Collection(parentRecord, name, opts, cb) {
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

    Collection.prototype._setInverseAssociation = function(resource) {
      return resource['$set' + this.$$options.inverseOf.camelize(true)].call(resource, this.$parentRecord);
    };

    Collection.prototype.$next = function(pageSize) {
      if (this.$ref().scroll) {
        return this.$ref().scroll.next(pageSize);
      } else {
        return false;
      }
    };

    Collection.prototype.$create = function(data) {
      return this.$$targetClass.$create(data).then((function(_this) {
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

    Collection.prototype.$$added = function(snap) {
      var result;
      result = $firebaseArray.prototype.$$added.apply(this, arguments);
      if (result) {
        return this.$$targetClass.$find(snap.key()).$loaded();
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

angular.module('angularfire-resource').factory('fireResource', function($firebaseObject, $firebaseUtils, fireCollection, AssociationFactory) {
  return function(resourceRef, resourceOptions) {
    var Resource;
    if (resourceOptions == null) {
      resourceOptions = {};
    }
    return Resource = (function() {
      function Resource(ref) {
        return $firebaseObject.call(this, ref);
      }

      Resource._assoc = new AssociationFactory(Resource);

      Resource.$name = resourceOptions.name || resourceRef.key().replace(/s$/, '');

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
        return this._assoc.create('hasMany', name, opts, cb);
      };

      Resource.hasOne = function(name, opts) {
        if (opts == null) {
          opts = {};
        }
        return this._assoc.create('hasOne', name, opts);
      };

      Resource.belongsTo = function(name, opts) {
        if (opts == null) {
          opts = {};
        }
        return this._assoc.create('belongsTo', name, opts);
      };

      Resource.prototype.$destroy = function() {
        var name, opts;
        if ((function() {
          var ref1, results;
          ref1 = this._assoc.map;
          results = [];
          for (name in ref1) {
            opts = ref1[name];
            results.push(this['$$' + name] != null);
          }
          return results;
        }).call(this)) {
          this['$$' + name].$destroy();
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
