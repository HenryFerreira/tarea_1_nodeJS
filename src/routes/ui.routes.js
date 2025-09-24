const { Router } = require('express');
const router = Router();

// Home = panel de administración (la vista se auto-protege en cliente)
router.get('/',      (req, res) => res.render('admin/index'));
router.get('/admin', (req, res) => res.render('admin/index'));

module.exports = router;
