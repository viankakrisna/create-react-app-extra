module.exports = function isProduction(){
    return process.env.NODE_ENV === 'production'
}