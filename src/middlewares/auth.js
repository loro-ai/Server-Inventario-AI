const { expressjwt } = require('express-jwt');

const auth = expressjwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
});

module.exports = auth;
