import normalize from 'json-api-normalizer'

import { Api } from './Api'
import { ModuleBuilder } from '../module/ModuleBuilder'
import { createApiResourceMethodProxy } from './createApiResourceMethodProxy'
import { hasOwn } from '../shared/utils'
import { Performance } from '../shared/Performance'

export class ResourcefulApi extends Api {
  /**
   * Extends `Api::doRequest()` to handle some data preprocessing.
   *
   * The api modules don't require access to all of the response
   * and they expect the response data to be normalized.
   *
   * @inheritdoc
   * @param {String} method
   * @param {String} url
   * @param {Object} params
   * @param {Object} data
   * @param {Object} options
   */
  async doRequest (method, url, params, data, options) {
    return super.doRequest(method, url, params, data, options)
      .then((response) => {
        return {
          data: normalize(response.data),
          meta: response.data.meta,
          status: response.status
        }
      })
  }

  /**
   * Prepare the routable requests
   *
   * @param {route.Router} router
   */
  setupResourcefulRequests (router) {
    this.router = router

    Performance.mark('api_setup_routing_start')

    const routes = router.getRoutes()
    this.registerableModules = {}

    for (const routeName in routes) {
      if (hasOwn(routes, routeName)) {
        const methods = routes[routeName]

        this.registerResourceMethods(routeName, methods)
        this.registerableModules[routeName] = methods
      }
    }

    Performance.mark('api_setup_routing_end')
    Performance.measure(
      'api: setup resourceful routing',
      'api_setup_routing_start',
      'api_setup_routing_end'
    )
  }

  /**
   *
   * @param {Vuex.Store} store
   */
  setStore (store) {
    this.store = store
  }

  /**
   *
   * @param {Array} apiModulesToRegister
   */
  setupApiModules (apiModulesToRegister = []) {
    Performance.mark('api_setup_modules_start')

    apiModulesToRegister.forEach(moduleName => this.registerModule(moduleName, this[moduleName]))

    Performance.mark('api_setup_modules_end')
    Performance.measure(
      'api: setup api modules',
      'api_setup_modules_start',
      'api_setup_modules_end'
    )
  }

  /**
   *
   * @param {String} moduleName
   * @param {Route} methods
   */
  registerModule (moduleName, methods) {
    // prevent double registration
    if (hasOwn(this.store.state, moduleName)) {
      return
    }

    const moduleBuilder = new ModuleBuilder(this.store, this, moduleName, methods)
    const module = moduleBuilder.build()
    if (moduleName) {
      this.store.registerModule(moduleName, module)
    }
  }

  /**
   *
   * @param {String} routeName
   * @param {Route} methods
   */
  registerResourceMethods (routeName, methods) {
    this[routeName] = {}

    Performance.mark('api_setup_proxies_start')

    for (const methodName in methods) {
      if (hasOwn(methods, methodName)) {
        const route = methods[methodName]

        if (methodName.indexOf('related.') === 0) {
          this.registerRelatedResourceMethod(routeName, methodName, route)
          continue
        }

        this[routeName][methodName] = createApiResourceMethodProxy(this, methodName, route)
      }
    }

    Performance.mark('api_setup_proxies_end')
    Performance.measure(
      'api: add method proxies for route ' + routeName,
      'api_setup_proxies_start',
      'api_setup_proxies_end'
    )
  }

  registerRelatedResourceMethod (routeName, methodName, route) {
    const [related, resource, relationMethod] = methodName.split('.')

    if (typeof this[routeName][related] !== 'object') {
      this[routeName][related] = {}
    }

    if (typeof this[routeName][related][resource] !== 'object') {
      this[routeName][related][resource] = {}
    }

    this[routeName][related][resource][relationMethod] =
      createApiResourceMethodProxy(this, relationMethod, route)
  }

  /**
   * Register an api module
   *
   * After api initialization, this is the way to register
   * non-default modules.
   *
   * its purpose is to get called from store, where its referenced from the initJsonApiPlugin.
   * At that point `this` is the store and not the api object
   *
   * @param {String} moduleName
   */
  registerApiModule (moduleName) {
    return this.api.registerModule(moduleName, this.api[moduleName])
  }

  /**
   * Get a list of available api modules
   *
   * A module is available if it has defined routing.
   * If `onlyUnregistered` is set to false, this list
   * will also return already registered modules.
   *
   * @param {Boolean} onlyUnregistered
   * @returns {Array}
   */
  getAvailableApiModules (onlyUnregistered = true) {
    const availableModules = Object.keys(this.registerableModules)

    if (onlyUnregistered) {
      return availableModules.filter((moduleName) => {
        return !hasOwn(this.state, moduleName)
      })
    }
    return availableModules
  }
}
