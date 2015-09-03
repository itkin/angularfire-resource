
angular.module('angularfire-resource')

.factory 'Collection', ($firebaseArray, $firebaseUtils) ->

  # Base class for Collection
  #
  # see {Collection#constructor}
  #
  class Collection

    # Contructor of {Collection}
    #
    # @param {Resource} targetClass the class of the model retrieved
    # @param {Function} cb a function to customise the reference to be used (default to Resource.$ref())
    #
    # @return {Array} the collection itself, which is an extended Array of instances
    #
    # @example instanciate a collection of users
    #   new Collection User
    #
    # @example instanciate a collection of some users
    #   new Collection User, (baseRef, init) -> init(new Firebase.util.Scroll(baseRef, 'sortingProp')).$next(10)
    #
    constructor: (targetClass, cb) ->
      @$$targetClass = targetClass
      @$$init(@$$targetClass.$ref(), cb)
      return @$list

    # Internal function used to init the Collection
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


  $firebaseArray.$extend Collection

.factory 'AssociationCollection', ($firebaseArray, $injector, Collection, $firebaseUtils) ->

  # Collection returned by a association
  #
  #
  class AssociationCollection extends Collection

    constructor: (association, parentRecord, cb) ->
      @$$association = association
      @$$targetClass = association.targetClass()
      @$$parentRecord = parentRecord
      throw "Association Error : parent instance should be saved" if @$$parentRecord.$isNew()

      ref = @$$parentRecord.$ref().child(@$$association.name)
      @$$init ref, cb
      return @$list

    # delegate to the parent klass constructor to create item and then add it to the collection
    $create: (data)->
      @$$association.targetClass().$create(data).then (resource) =>
        @$add(resource)


    # We do not use $save to save a $$notify cb
    $add: (resource) ->
      $firebaseUtils.resolve( resource.$save() if resource.$isNew() )
      .then =>
        $firebaseUtils.reject() if @$indexFor(resource.$id) isnt -1
      .then =>
        @$$association.add(resource, to: @$$parentRecord)
      .then (resource) =>
        @$$association.reverseAssociation().add(@$$parentRecord, to: resource) if @$$association.reverseAssociation()
      .catch ->
        console.log("resource allready in the collection")
      .then ->
        resource

    $remove: (resource) ->
      $firebaseArray::$remove.call(this, resource)
      .then =>
        @$$association.reverseAssociation().remove(@$$parentRecord, from: resource) if @$$association.reverseAssociation()
      .catch =>
        console.log @$$association.name.camelize(true), @$$parentRecord.$id, @$$association.name, arguments
      .then ->
        resource

#    $destroy: ->
##      item.$destroy() for item in @$list
#      $firebaseArray::$destroy.apply(this, arguments)

    $$notify: ->
      console.log @$$parentRecord.constructor.$name.camelize(true), @$$parentRecord.$id, @$$association.name, arguments[0], arguments[1]
      $firebaseArray::$$notify.apply this, arguments

