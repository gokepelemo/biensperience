class OwnershipError extends Error {
    constructor () {
      super()
      this.name = 'OwnershipError'
      this.message = 'The provided token does not match the owner of this document'
    }
  }
  
  class DocumentNotFoundError extends Error {
    constructor () {
      super()
      this.name = 'DocumentNotFoundError'
      this.message = 'The provided ID doesn\'t match any documents'
    }
  }
  
  class BadParamsError extends Error {
    constructor () {
      super()
      this.name = 'BadParamsError'
      this.message = 'A required parameter was omitted or invalid'
    }
  }

  const requireOwnership = (req, res) => {
    if (!req.user._id.equals(res.owner)) {
      throw new OwnershipError()
    }
  }

  const handle404 = record => {
    if (!record) {
      throw new DocumentNotFoundError()
    } else {
      return record
    }
  }
  
  module.exports = {
    requireOwnership,
    handle404,
    BadParamsError
  }