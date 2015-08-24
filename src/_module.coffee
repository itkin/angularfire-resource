
angular.module('angularfire-resource', [])

.factory 'utils', () ->
  toCamelCase: (name) ->
    name.replace /(-|\s)(\w)/g, (match) ->
      match[1].toUpperCase()






