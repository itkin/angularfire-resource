angular.module('angularfire-resource')

.factory 'FireResource', [
  '$firebaseObject',
  '$firebaseUtils',
  'Collection',
  'AssociationFactory',
  ($firebaseObject, $firebaseUtils, Collection, AssociationFactory) ->

    (resourceRef, resourceOptions={}, callback) ->

      if angular.isFunction(resourceOptions)
        callback = resourceOptions
        resourceOptions = {}


      # Base resource class
      #
      # @note Resource classes are created by the FireResource factory
      #
      # @param ref {ref} firebase reference
      # @param opts {Object} options (optional)
      # @param callack {Function} optional function called in the context of the defined Resource (to add methods, relations, or override stuff)
      # @return {Resource} the Resource class ready to be used by the angular factory
      #
      # Below the different way to use the FireResource factory
      #
      # @example Basic model
      #   app.module('myApp').factory 'User', (FireResource, $firebase) ->
      #     FireResource $firebase.child('users')
      #
      # @example Class methods not prefixed with `$` are chainable
      #   factory 'User', (FireResource, $firebase) ->
      #     FireResource($firebase.child('users'))
      #       .hasMany 'conversations'
      #       .hasOne 'displayedConversation',
      #         className: 'Conversation'
      #         inverseOf: false
      #
      # @example Pass a callback as the last argument to access the resource from within
      #   factory 'User', (FireResource, $firebase) ->
      #     FireResource $firebase.child('users'), ->
      #       @hasMany 'conversations'
      #       @hasOne 'displayedConversation',
      #         className: 'Conversation'
      #         inverseOf: false
      #       @::myCostomInstanceMethod = -> "i'm custom"
      #
      # @See the README file
      #
      # @method #$id
      #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
      # @method #$ref()
      #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
      # @method #$bindTo(scope, varName)
      #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
      # @method #$watch(callback, context)
      #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
      #
      class Resource

        map = {}
        #
        # Resource constructor is called internally by {Resource.$find} or {Resource.$new}
        # @note: Do not instanciate any Resource but prefer to use {Resource.$find} or {Resource.$new}
        constructor: (ref) ->
          map[ref.key()]= this
          $firebaseObject.call this, ref
          @$$isNew  = false
          @$$loaded = false
          @$include(resourceOptions.includes)

        # @property Map storing the Resource associations instances
        @_assoc: {}

        # @property Resource name
        @$name: resourceOptions.name or resourceRef.key().replace(/s$/,'')

        # Base Firebase reference passed to the FireResource Factory
        # @return {ref} firebase reference
        @$ref: ->
          resourceRef


        # Collection Resource getter, query firebase on the {Resource.$ref}
        # @param cb {Function} function to customize the Collection ref. Take as parameters a reference and an init callback function that has to be called
        # @return {Collection} instance of {Collection}
        #
        # @example Basic
        #   User.$query()
        #
        # @example Using Firebase.util.Scroll
        #   User.$query (baseRef, init) ->
        #     init(new Firebase.util.Scroll baseRef, 'presence' ).$next(10)
        #
        @$query: (cb) ->
          new Collection Resource, cb

        # Resource instance builder
        # @param data {Object} the instance attributes
        # @return {Resource} instance
        # @option data {String, Number} id Optional id of the instance, should be unique, defaults to {Resource.$ref}().push()
        # @note New resource instance cannot instanciate any {AssociationCollection} until they are saved or added to an {AsscoationCollection}
        # @example
        #   user = User.$new email: 'myEmail'
        # @example
        #   user = User.$new id: "myId", email: 'myEmail'
        @$new: (data={}) ->
          if data.id?
            instance = new this(@$ref().child(data.id))
            delete data.id
          else
            instance = new this(@$ref().push())
          instance.$$isNew = true
          angular.extend instance, data
          instance

        # Creates a resource from data
        # @param data {object} resource data
        # @return {Promise} instance
        #
        @$create: (data={}) ->
          @$new(data).$save()

        # Resource Getter
        # @param {String} Firbase key of the instance
        # @return {Resource} instance
        #
        @$find: (key, opts={}) ->
          if map[key]
            inst = map[key]
          else
            inst = new Resource Resource.$ref().child(key)
          inst.$includes(opts.includes) if opts.includes?
          inst

        # One to Many association builder
        #
        # @param {String} association name
        # @param {Object} association option
        # @option options {String} className targetted resource factory name, defaults to `name.camelize(true)`
        # @option options {String} inverseOf inverse association, defaults to `Resource.$name`, if `false` association will be considered one sided
        # @param {Function} callback function customize the association collection ref or add some method
        # @return {Resource} the current resource
        #
        # @example
        #   factory 'User', (FireResource, $firebase) ->
        #     FireResource $firebase.child('users'), ->
        #       @hasMany 'conversations'
        #
        # @example the above association gives you access to the association collection via a getter method prefixed by `$` :
        #   user.$conversations()
        #
        # @example you can customize its ref any time by passing it an init function
        #   user.$conversations (baseRef, init) -> init(new Firebase.util.Scroll(baseRef, '$key')).$next(10)
        #
        # @example the association collection is cached on the parent instance on a property prefixed by `$$`
        #   user.$conversations() === user.$$conversations
        #
        # @example when the parent user is `$destroyed`, its association collection are too, but not its associated instances
        #   user.$destroy()
        #   user.$$conversations === undefined
        #
        @hasMany: (name, opts={}, cb)->
          @_assoc[name] = new AssociationFactory.HasMany(this, name, opts, cb)
          this


        # One to One association builder
        # @param {String} name
        # @param {Object} options
        # @option options {String} className targetted resource factory name, defaults to `name.camelize(true)`
        # @option options {String} foreignKey property used to store the associated instance key, defaults to `name + 'Id'`
        # @option options {String} inverseOf inverse association, defaults to `Resource.$name`, if `false` association will be considered one sided
        # @return {Resource} the current resource
        #
        # @example
        #   factory 'Message', (FireResource, $firebase) ->
        #     FireResource $firebase.child('messages'), ->
        #       @hasOne 'user', inverseOf: false
        #
        #     is the same than doing :
        #     FireResource $firebase.child('messages'), ->
        #       @hasOne 'user', className: 'User', forereignKey: 'userId', inverseOf: false
        #
        # @example the above association dynamically create the following methods on any Message instance
        #   message.$user() #get the associated user
        #   message.$setUser( userInstance ) #associate a user instance
        #   message.$createUser( userData ) #create an associated user instance
        #
        @hasOne: (name, opts = {}) ->
          @_assoc[name] = new AssociationFactory.HasOne(this, name, opts)
          this


        for cbName in ['beforeCreate', 'beforeSave', 'afterSave', 'afterCreate']
          ( (cbName) ->
            Resource['_' + cbName]= []
            Resource[cbName]= (cb) ->
              Resource['_' + cbName].push cb
              this
          )(cbName)


        # Clear the resource map where are stored all the instances retrieved from firebase. Clearing the map destroy them all
        @clearMap: ->
          for key, instance of map
            instance.$destroy()


        #INSTANCES METHODS

        # check wether the instance has been saved to firebase
        # @return {Boolean}
        $isNew: ->
          @$$isNew

        # Ensure the instance and its included relations are loaded
        #
        # @return {promise} resolved with the instance resource
        #
        $loaded: ->
          $firebaseObject::$loaded.apply(this, arguments)
            .then =>
              @$$loadIncludes()
            .then =>
              @$$loaded = true
              this

        # wrap the original angularfire $save function into the callback chain and deal with the timestamps
        # @return {Promise} a promise which resolve with the resource instance
        $save: ->
          args = arguments
          isNew = @$isNew()
          self = this
          $firebaseUtils.resolve()
          .then ->
            self.$$runCallbacks('beforeCreate') if isNew
          .then ->
            self.$$runCallbacks('beforeSave')
          .then ->
            self.createdAt = Firebase.ServerValue.TIMESTAMP if isNew
            self.updatedAt = Firebase.ServerValue.TIMESTAMP
          .then ->
            $firebaseObject::$save.apply(self, args)
          .then ->
            self.$$runCallbacks('afterCreate') if isNew
          .then ->
            self.$$runCallbacks('afterSave')
          .then ->
            self


        # Set the include association attached to the instance
        #
        # @return {resource} instance
        #
        # @example
        #   User.$find(key).$include('messages').$loaded (user) ->
        #     user.$messages().$$loaded == true
        #
        $include: (includes) ->
          @$$setIncludes(includes)
          @$loaded()
          this

        # Override the angulafire $destroy to call {AssociationCollection#$destroy} on the instanciated associations and remove the object from the map
        $destroy: ->
          for name, assoc of @constructor._assoc
            @['$$' + name].$destroy() if @['$$' + name]?
          $firebaseObject.prototype.$destroy.apply(this, arguments)
          delete map[@$id]

        # Extend instance with data and call {Resource#$save}
        # @param {Object} data
        # @return {Promise} promise which resolve into the instance resource once saved
        $update: (data) ->
          angular.extend this, data
          @$save()


        # internally load the includes (internally called by {Resource#$loaded} at the instanciation)
        # @note internal
        # @return {Promise} promise
        $$loadIncludes: ->
          promises = []
          for name, opts of @$$includes
            if opts == true
              promises.push @["$#{name}"]().$loaded()
            else
              promises.push @["$#{name}"](opts).$loaded()
          $firebaseUtils.allPromises(promises)

        # internal method to set the includes
        # @note internal
        # @param includes {Object, Array, String}
        #
        $$setIncludes: (includes) ->
          @$$includes or={}
          if angular.isString(includes)
            @$$includes[includes]= true
          else if angular.isArray(includes)
            @$$setIncludes(include) for include in includes
          else if angular.isObject(includes)
            angular.extend @$$includes, includes

        # Overriden angularfire hook to update hasOne assoc cached instances if changed server side
        # @note internal
        # @return {Boolean} change
        $$updated: (snap) ->

          # state prop value to update eventually
          @$$isNew = false if @$$isNew and snap.val()

          # Update cached instance for hasOne assoc if loaded and changed server side
          old = $firebaseUtils.toJSON(this)
          result = $firebaseObject::$$updated.apply(this, arguments)
          for name, assoc of @constructor._assoc
            if assoc.type is 'HasOne' and @["$$#{name}"]? and @[assoc.foreignKey] isnt old[assoc.foreignKey]
              @["$$#{name}"] = null
              @["$#{name}"]()
          result

        # Run a callback chain
        # @param {String} name
        # @return {Promise} promise
        $$runCallbacks: (name) ->
          promise = $firebaseUtils.resolve()
          self = this
          for cb in @constructor['_' + name]
            cb = @[cb] if angular.isString(cb)
            ((cb) ->
              promise = promise.then ->
                cb.apply(self, [self])
            )(cb)

          promise

  #      $$notify: ->
  #        console.log @constructor.$name.camelize(true), @$id, "updated"
  #        $firebaseObject::$$notify.apply this, arguments

        $firebaseObject.$extend Resource

        callback.call(this) if callback?

        Resource

  ]