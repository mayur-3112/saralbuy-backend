import express from 'express'
import adminAuth from '../../middleware/adminAuth.middleware.js'
import { getCategoryNameWise,updateCategory } from '../../controllers/admin/categories.controller.js'
const router = express.Router()

router
.route('/')
.all(adminAuth)
.get(getCategoryNameWise)
.put(updateCategory)

export default router