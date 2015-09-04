
angular.module('angularfire-resource')

.factory 'Collection', [
  '$firebaseArray',
  '$firebaseUtils',
  ($firebaseArray, $firebaseUtils) ->

    # Base class for Collection
    #
    # Refer to {Collection#constructor}
    #
    # @method #$getRecord(key)
    #   @return {Resource} instance
    #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
    # @method #$keyAt(instance)
    #   @return {String} resource key
    #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
    # @method #$indexFor(key)
    #   @return {integer} index
    #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
    # @method #$watch(cb,[context])
    #   @see https://www.firebase.com/docs/web/libraries/angular/api.html
    #
    class Collection

      # Constructor of {Collection}
      #
      # @note {Collection} are instanciated internally by {Resource.$query}
      #
      # @param {Resource} targetClass the class of the model retrieved
      # @param {Function} cb a function to customise the reference to be used (default to {Resource.$ref})
      #
      # @return {Array} the collection itself, which is an extended Array of instances
      #
      # @example default reference ({Resource.$ref})
      #   new Collection User
      #
      # @example custom reference, after the init callback has been called the association instance is considered alive,
      #   new Collection User, (baseRef, init) ->
      #     init(new Firebase.util.Scroll(baseRef, 'sortingProp')).$next(10)
      #   #
      #   # calling $next allow the association to start loading the 10 first instances
      #   #
      constructor: (targetClass, cb) ->
        @$$targetClass = targetClass
        @$$init(@$$targetClass.$ref(), cb)
        return @$list

      # Override angularfire $loaded to load the includes of the association items
      #
      # @return {promise} a promise
      #
      $loaded: ->
        $firebaseArray::$loaded.apply(this, arguments).then =>
          itemsPromises = []
          itemsPromises.push item.$loaded() for item in @$list
          $firebaseUtils.allPromises(itemsPromises)

      # Set the includes asocciated with the association item
      #
      # @param includes {array, object, string} includes object
      #
      # @return {this} the association (to chain this method)
      #
      $include: (includes) ->
        @$loaded().then =>
          @$$includes = includes
          instance.$include(@$$includes) for instance in @$list
        this

      # move the caret of a scrollable readonly ref
      #
      # @param pageSize {Number} number of items to load
      #
      # @return {promise} a promise
      #
      $next: (pageSize) ->
        if @$ref().scroll
          def = $firebaseUtils.defer()
          if @$ref().scroll.hasNext()
            @$ref().once 'value', =>
              @$loaded().then => def.resolve(this)
            @$ref().scroll.next(pageSize)
          else
            def.resolve(this)
          def.promise
        else
          false

      # move the caret of a scrollable readonly ref
      #
      # @param pageSize {Number} number of items to load
      #
      # @return {promise} a promise
      #
      $prev: (pageSize) ->
        if @$ref().scroll
          def = $firebaseUtils.defer()
          if @$ref().scroll.hasPrev()
            @$ref().once 'value', =>
              @$loaded().then => def.resolve(this)
            @$ref().scroll.prev(pageSize)
          else
            def.resolve(this)
          def.promise
        else
          false


      # initialise a {Collection} calling $firebaseArray constructor on a firebase reference which defaults to the passed reference
      # @param {Reference} baseRef
      # @param {Function} callback function taking as parameter the baseRef and an initialization callback function which have to be called within it
      #
      $$init: (baseRef, cb) ->
        self = this
        init = (ref) ->
          $firebaseArray.call self, ref
          self

        if cb?
          cb.call(this, baseRef, init)
        else
          init(baseRef)

      # Angularfire hook overrided to retreiece the targetted class instances based
      #
      # @return {resource} Resource instance
      #
      $$added: (snap) ->
        result = $firebaseArray::$$added.apply(this, arguments)
        if result
          @$$targetClass.$find(snap.key()).$include(@$$includes)
        else
          result

      # Angularfire hook overrided to prevent collision between instances and foreign key updates
      # Disable foreign key update while instances updates are handled on their own
      #
      $$updated: (snap) ->
        false



    $firebaseArray.$extend Collection
  ]
.factory 'AssociationCollection', [
  '$firebaseArray',
  '$injector',
  'Collection',
  '$firebaseUtils',
  ($firebaseArray, $injector, Collection, $firebaseUtils) ->

    # Collection returned by a association
    #
    # @note {AssociationCollection} are instanciated internally by the getter method generated by {Resource.hasMany}
    #
    class AssociationCollection extends Collection

      # @note {AssociationCollection} are instanciated internally by the getter method generated by {Resource.hasMany}
      constructor: (association, parentRecord, cb) ->
        @$$association = association
        @$$targetClass = association.targetClass()
        @$$parentRecord = parentRecord
        throw "Association Error : parent instance should be saved" if @$$parentRecord.$isNew()

        ref = @$$parentRecord.$ref().child(@$$association.name)
        @$$init ref, cb
        return @$list

      # delegate to the parent klass constructor to create item and then add it to the collection
      # @param {Object} data
      # @return {Promise} promise which resolve into the added resource instance
      $create: (data)->
        @$$association.targetClass().$create(data).then (resource) =>
          @$add(resource)


      # Add a resource instance to the collection
      # @param {Resource} instance
      # @return {Promise} promise which resolve into the added resource instance
      $add: (resource) ->
        $firebaseUtils.resolve( resource.$save() if resource.$isNew() )
        .then =>
          $firebaseUtils.reject() if @$indexFor(resource.$id) isnt -1
        .then =>
          @$$association.add(resource, to: @$$parentRecord)
        .then (resource) =>
          if @$$association.reverseAssociation()
            @$$association.reverseAssociation().add(@$$parentRecord, to: resource)
        .catch ->
          console.log("resource allready in the collection")
        .then ->
          resource

      # Remove an Resource instance from the association, but to not remove the instance
      # @param {Resource} resource instance
      # @return {Promise} promise which resolves into the removed instance resource
      $remove: (resource) ->
        $firebaseArray::$remove.call(this, resource)
        .then =>
          if @$$association.reverseAssociation()
            @$$association.reverseAssociation().remove(@$$parentRecord, from: resource)
        .catch =>
          console.log @$$association.name.camelize(true), @$$parentRecord.$id, @$$association.name, arguments
        .then ->
          resource

  ]