const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => res.redirect('/login'));  // Home: redirige a login y, tras loguear, va a /admin

router.get('/admin', (req, res) => res.render('admin/index')); // Home = panel de administración (la vista se auto-protege en cliente)

// GET /login  -> renderiza la página de inicio de sesión
router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Iniciar sesión' });
});

// Registro y logout (vistas)
router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Crear cuenta' });
});

router.get('/logout', (req, res) => {
  res.render('auth/logout', { title: 'Cerrar sesión' });
});


module.exports = router;


