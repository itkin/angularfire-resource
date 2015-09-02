
angular.module('angularfire-resource')

.factory 'Collection', ($firebaseArray, $firebaseUtils) ->

  class Collection
    constructor: (targetClass, cb) ->
      @$$targetClass = targetClass
      @$$init(@$$targetClass.$ref(), cb)
      return @$list

    $$init: (baseRef, cb) ->
      self = this
      init = (ref) ->
        $firebaseArray.call self, ref
        self

      if cb?
        cb.call(this, baseRef, init)
      else
        init(baseRef)

    $loaded: ->
      $firebaseArray::$loaded.apply(this, arguments).then =>
        itemsPromises = []
        itemsPromises.push item.$loaded() for item in @$list
        $firebaseUtils.allPromises(itemsPromises)

    $include: (includes) ->
      @$loaded().then =>
        @$$includes = includes
        instance.$include(@$$includes) for instance in @$list
      this

    # retrieve the associated resource
    $$added: (snap) ->
      result = $firebaseArray::$$added.apply(this, arguments)
      if result
        @$$targetClass.$find(snap.key()).$include(@$$includes)
      else
        result

    #no update (they are done via the instance)
    $$updated: (snap) ->
      false

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

    $prev: (pageSize) ->
      if @$ref().scroll
        @$ref().scroll.prev(pageSize)
        @$loaded()
      else
        false

  $firebaseArray.$extend Collection

.factory 'AssociationCollection', ($firebaseArray, $injector, Collection, $firebaseUtils) ->

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
        .then -> resource

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

