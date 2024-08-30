import { Comment } from '../model/comment.model.js'
import { isString } from './general.assert.js'

export function isComment(obj: unknown): obj is Comment {
  const { user, data } = (obj || {}) as Comment

  return Boolean(isString(user) && isString(data))
}
