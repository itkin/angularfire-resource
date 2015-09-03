angular.module('angularfire-resource')

.factory 'FireResource', ($firebaseObject, $firebaseUtils, Collection, AssociationFactory) ->

  (resourceRef, resourceOptions={}, callback) ->

    if angular.isFunction(resourceOptions)
      callback = resourceOptions
      resourceOptions = {}


    # Base resource class
    #
    # @note Resource classes are created by the FireResource factory
    #
    # @param resourceRef {ref} firebase reference
    # @param resourceOptions {Object} options (optional)
    # @param callack {Function} optional function called in the context of the defined Resource (to add methods, relations, or override stuff)
    # @return {Resource} the Resource class ready to be used by the angular factory
    #
    # Below the different way to use the FireResource factory
    #
    # @example Basic model
    #   app.module('myApp').factory 'User', (FireResource, $firebase) ->
    #     FireResource $firebase.child('users')
    #
    # @example Chaining class method calls
    #   factory 'User', (FireResource, $firebase) ->
    #     FireResource $firebase.child('users')
    #       .hasMany 'conversations'
    #       .hasOne 'displayedConversation',
    #         className: 'Conversation'
    #         inverseOf: false
    #
    # @example Accessing the resource from within
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
    class Resource

      map = {}
      #
      # Resource constructor is called internally by {Resource.$find} or {Resource.$new}
      #
      constructor: (ref) ->
        map[ref.key()]= this
        $firebaseObject.call this, ref
        @$$isNew  = false
        @$$loaded = false
        @$$setIncludes(resourceOptions.include)
        @$loaded()

      # @property Map storing the Resource associations instances
      @_assoc: {}

      # Clear the resource map where are stored all the instances retrieved from firebase. Clearing the map destroy them all
      @clearMap: ->
        for key, instance of map
          instance.$destroy()

      # @property Resource name
      @$name: resourceOptions.name or resourceRef.key().replace(/s$/,'')

      # Query firebase on the {Resource.$ref}
      # @param cb {Function} function to customize the ref, takes {Resrouce.$ref} and an init callback function that you have to call as parameters
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

      # Base Firebase reference passed to the FireResource Factory
      # @return {ref} firebase reference
      @$ref: ->
        resourceRef

      # Resource instance builder
      # @param data {Object} the instance attributes
      # @return {Resource} instance
      #
      # NB: New resource instance cannot instanciate any {AssociationCollection}
      #
      @$new: (data={}) ->
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
      #
      @hasMany: (name, opts={}, cb)->
        @_assoc[name] = new AssociationFactory.HasManyAssociation(this, name, opts, cb)
        this


      # One to One association builder
      # @param {String} name
      # @param {Object} options
      # @option options {String} className targetted resource factory name, defaults to `name.camelize(true)`
      # @option options {String} foreignKey property used to store the associated instance key, defaults to `name + 'Id'`
      # @option options {String} inverseOf inverse association, defaults to `Resource.$name`, if `false` association will be considered one sided
      # @return {Resource} the current resource
      #
      @hasOne: (name, opts = {}) ->
        @_assoc[name] = new AssociationFactory.HasOneAssociation(this, name, opts)
        this


      for cbName in ['beforeCreate', 'beforeSave', 'afterSave', 'afterCreate']
        ( (cbName) ->
          Resource['_' + cbName]= []
          Resource[cbName]= (cb) ->
            Resource['_' + cbName].push cb
            this
        )(cbName)


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


      $$loadIncludes: ->
        promises = []
        for name, opts of @$$includes
          if opts == true
            promises.push @["$#{name}"]().$loaded()
          else
            promises.push @["$#{name}"](opts).$loaded()
        $firebaseUtils.allPromises(promises)

      $$setIncludes: (includes) ->
        @$$includes or={}
        if angular.isString(includes)
          @$$includes[includes]= true
        else if angular.isArray(includes)
          @$$setIncludes(include) for include in includes
        else if angular.isObject(includes)
          angular.extend @$$includes, includes

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

      $destroy: ->
        for name, assoc of @constructor._assoc
          @['$$' + name].$destroy() if @['$$' + name]?
        $firebaseObject.prototype.$destroy.apply(this, arguments)
        delete map[@$id]

      $update: (data) ->
        angular.extend this, data
        @$save()

      # Update cached instance for hasOne assoc if changed server side
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

      # wrap the original angularfire $save function into the callback chain
      $save: ->
        $firebaseUtils.resolve()
        .then =>
          @$$runCallbacks('beforeCreate') if @$isNew()
        .then =>
          @$$runCallbacks('beforeSave')
        .then =>
          @createdAt = Firebase.ServerValue.TIMESTAMP if @$isNew()
          @updatedAt = Firebase.ServerValue.TIMESTAMP
        .then =>
          $firebaseObject::$save.apply(this, arguments)
        .then =>
          @$$runCallbacks('afterCreate') if @$isNew()
        .then =>
          @$$runCallbacks('afterSave')
        .then =>
          this

      $$runCallbacks: (name) ->
        promise = $firebaseUtils.resolve()
        for cb in @constructor['_' + name]
          cb = @[cb] if angular.isString(cb)
          promise = promise.then => cb.call(this)
        promise

      $$notify: ->
        console.log @constructor.$name.camelize(true), @$id, "updated"
        $firebaseObject::$$notify.apply this, arguments

      $firebaseObject.$extend Resource

      callback.call(this) if callback?

      Resource