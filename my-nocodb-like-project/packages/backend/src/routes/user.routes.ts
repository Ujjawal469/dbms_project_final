import express from 'express';
import * as userController from '../controllers/user.controller'; // Assuming controller functions are here

const router = express.Router();

router.get('/isLoggedIn', userController.isLoggedIn);
router.post('/login', userController.login);
router.post('/signup', userController.signup);
router.post('/logout', userController.logout);

export default router;