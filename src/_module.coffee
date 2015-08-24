String::capitalize = ->
  @slice(0,1).toUpperCase() + @slice(1).toLowerCase()

String::camelize = (firstUp = false) ->
  result = this
    .replace /[\s|_|-](.)/g, ($1) -> $1.toUpperCase()
    .replace /[\s|_|-]/g, ''
    .replace /^(.)/, ($1) -> $1.toLowerCase()

  if firstUp
    result.slice(0,1).toUpperCase() + result.slice(1)
  else
    result


angular.module('angularfire-resource', [])







