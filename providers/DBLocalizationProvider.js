const { ServiceProvider } = use('@adonisjs/fold') 

class DBLocalizationProvider extends ServiceProvider {
  _registerMiddlewares () {

  }

  _registerTraits () {
    this.app.bind('App/Models/Traits/DBLocalization', (app) => {
      const DBLocalization = require('../src/Traits/DBLocalizationTrait')
      return new DBLocalization()
    })
  }
  //@todo check if this need
  register () {
    this._registerMiddlewares()
    this._registerTraits()
  }

  boot () {
  }
}

module.exports = DBLocalizationProvider