const { Router } = require('express');
const router = Router();

// Home = panel de administración (la vista se auto-protege en cliente)
router.get('/',      (req, res) => res.render('admin/index'));
router.get('/admin', (req, res) => res.render('admin/index'));

// GET /login  -> renderiza la página de inicio de sesión
router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Iniciar sesión' });
});

module.exports = router;


