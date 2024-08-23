function authMiddleware(req, res, next) {
  if (req.session && req.session.usuario) {
    res.locals.user = {
      name: req.session.usuario.nombre,
      role: req.session.usuario.rol,
    };
  }
  next();
}

module.exports = authMiddleware;
