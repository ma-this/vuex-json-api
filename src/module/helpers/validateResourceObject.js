/**
 * Do a crude check for common json:api resource properties.
 * This is (probably) not a long-term solution!
 *
 * Assumptions made:
 *
 * - Resource Objects always have a type and a data section
 * - newly created resources must not have an id (this is slightly
 *   stricter than the specification allows for and may be changed
 *   in the future)
 * - every other resource object should have an id
 *
 * @param {Object} resourceObject
 * @param {Boolean} isCreateResource
 */
export function validateResourceObject (resourceObject, isCreateResource) {
  let conformsToBasicStructure = typeof resourceObject === 'object' &&
    resourceObject.hasOwnProperty('type') &&
    resourceObject.hasOwnProperty('data')

  if (isCreateResource) {
    return conformsToBasicStructure && !resourceObject.hasOwnProperty('id')
  }

  if (!isCreateResource) {
    return conformsToBasicStructure && resourceObject.hasOwnProperty('id')
  }

  throw new Error('Detected potentially invalid json:api resource object')
}
