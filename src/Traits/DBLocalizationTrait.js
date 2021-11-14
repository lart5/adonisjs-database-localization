

const pluralize = use('pluralize')
const _ = use('lodash')
const Antl = use('Antl')

class DBLocalizationTrait {

    async localizeRow(modelInstance, options){
        if (modelInstance.$persisted) {
            let translation = modelInstance.getRelated('translation')
            
            if (!translation) {
              await modelInstance.load('translation')
              translation = modelInstance.getRelated('translation')
            }
            if (translation) {
                for (let attribute of options.attributes) {
                    modelInstance[attribute] = translation[attribute]
                }
            }else{
                throw new Error('Error load translations')
            }
          }
    }

    async localizeRows(modelInstance, options){
        if (modelInstance.$persisted) {
            let translations = modelInstance.getRelated('translations')
            
            if (!translations) {
              await modelInstance.load('translations')
              translations = modelInstance.getRelated('translations')
            }
            if (translations) {
                for(let translation of translations.rows){
                    for (let attribute of options.attributes) {
                        modelInstance[`${attribute}_${translation['locale']}`] = translation[attribute]
                    }
                }
            }else{
                throw new Error('Error load translations')
            }
          }
    }


    async register (Model, customOptions) {
        const defaultOptions = {
            className: '', //Class of Model for Translation table
            primaryKey: Model.primaryKey, // Primary key in parent table
            foreignKey: `${_.snakeCase(pluralize.singular(Model.table))}_id`, // Foreign key in translation table
            attributes: [], // Fields for translation
            locales: Antl.availableLocales(), 
            defaultLocale: Antl.defaultLocale() 
          }
        const options = _.extend({}, defaultOptions, customOptions)
        const that = this
        // attributes must be array
        if (_.isArray(options.attributes)) {

            /**
             * relation for translate fields to current locale
             */
            Model.prototype.translation = function () {
                return this.hasOne(
                    options.className,
                    options.primaryKey,
                    options.foreignKey
                ).where('locale', Antl.currentLocale())
            }
            /**
             * relation for receive translations for all locales
             */
            Model.prototype.translations = function () {
                let Model = this.hasMany(
                    options.className,
                    options.primaryKey,
                    options.foreignKey
                )
                return Model
            }

            /**
             * Method for receive translate for one field
             * @param {string} attribute - fiend name
             * @param {string} locale - locale for received value
             * @param {bool} defaultLocale - if true, then will have returned value for default locale, when value for needed locale not found
             * @param {*} defaultValue - if any values for locales not found, return this value
             */
            Model.prototype.translate = async function (attribute, locale, defaultLocale = true, defaultValue = null) {

                if (options.attributes.indexOf(attribute)==-1)throw Error('This field is not translatable')
                if (!locale)throw new Error('You mest set locale for translation')
                // Search for needed locale
                let query = this.hasMany(
                    options.className,
                    options.primaryKey,
                    options.foreignKey
                )

                let row = await query.where('locale', locale).first()
                if (row)return row[attribute]
                //Search for default locale
                if (defaultLocale) {
                    query = this.hasMany(
                        options.className,
                        options.primaryKey,
                        options.foreignKey
                    )
                    let row  = await query.where('locale', options.defaultLocale).first()
                    if (row)return row[attribute]
                }
                if (defaultValue!=null){
                    return defaultValue
                }
                return this[attribute]
            }
            /**
             * If used relation "translate", then after fetch one or many rows, attribute in parent model set with value for current locale
             */
            Model.addHook('afterFind', async (modelInstance) => {
                if (modelInstance.$relations && modelInstance.$relations.translation){
                    await that.localizeRow(modelInstance, options)
                }
                if (modelInstance.$relations && modelInstance.$relations.translations){
                    await that.localizeRows(modelInstance, options)
                }
            })
            Model.addHook('afterFetch', async (modelInstances) => {
                for (const modelInstance of modelInstances) {
                    if (modelInstance.$relations && modelInstance.$relations.translation){
                        await that.localizeRow(modelInstance, options)
                    }

                    if (modelInstance.$relations && modelInstance.$relations.translations){
                        await that.localizeRows(modelInstance, options)
                    }
                }
              })
            /**
             * When save model, you can set parameter "translations" as array with structure
             * {
             *    attribure:{
             *       locale: value,
             *       locale1: value1
             *    },
             *    attribure1:{
             *       locale: value,
             *       locale1: value1
             *    }
             * }
             * then values for all locales to be saved 
             */
            Model.addHook('beforeSave', async (instance) => {
                if (instance.$attributes.translations && _.isObject(instance.$attributes.translations)){
                    instance.__setters__.push('$saveTraslations')
                    instance.$saveTraslations = instance.$attributes.translations
                    delete instance.$attributes.translations
                    for(let attribute in instance.$saveTraslations){
                        if (options.attributes.indexOf(attribute)!=-1){
                            for(let lang in instance.$saveTraslations[attribute]){
                                if (options.locales.indexOf(lang)==-1)continue
                                if (lang == options.defaultLocale){
                                    instance[attribute] = instance.$saveTraslations[attribute][lang]  
                                }
                            }
                        }
                    }
                }
            })
            Model.addHook('afterSave', async (instance) => {
                if (instance.$saveTraslations){
                    for(let attribute in instance.$saveTraslations){
                        if (options.attributes.indexOf(attribute)!=-1){
                            for(let lang in instance.$saveTraslations[attribute]){
                                if (options.locales.indexOf(lang)==-1)continue
                                let t = await instance.hasOne(
                                    options.className,
                                    options.primaryKey,
                                    options.foreignKey
                                ).where('locale', lang).first()
                                if (t){
                                    t[attribute] = instance.$saveTraslations[attribute][lang]
                                    await t.save()
                                }else{
                                    let ClassName = use(options.className)
                                    t = new ClassName()
                                    t.locale = lang
                                    t[attribute] = instance.$saveTraslations[attribute][lang]
                                    await instance.translations().save(t)
                                }
                            }
                        }
                    }
                    delete instance.$saveTraslations
                }
            })
        }else{
            throw new Error('Option attributes must be array')
        }
    }


}

module.exports = DBLocalizationTrait