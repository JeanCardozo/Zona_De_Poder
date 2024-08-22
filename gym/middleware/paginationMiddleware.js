async function paginationMiddleware(req, res, next) {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 5;
  let offset = limit * (page - 1);
  let totalClients = await getTotalClientsCount(); // Debes crear esta función según tu lógica de base de datos

  let totalPages = Math.ceil(totalClients / limit);

  // Asume que baseUrl es la ruta base para tus controles de paginación, podrías ajustar esto según necesites
  let baseUrl = req.baseUrl + "?";

  req.pagination = {
    currentPage: page,
    totalPages,
    baseUrl,
    limit,
    offset,
  };

  next();
}

module.exports = paginationMiddleware;
