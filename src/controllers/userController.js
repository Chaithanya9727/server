import User from "../models/User.js"

// @desc Get all users
// @route GET /api/users
// @access Admin
export const getUsers = async (req, res) => {
  const users = await User.find().select("-password") // don’t send password
  res.json(users)
}

// @desc Delete a user
// @route DELETE /api/users/:id
// @access Admin
export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id)

  if (!user) {
    return res.status(404).json({ message: "User not found" })
  }

  await user.deleteOne()
  res.json({ message: "User deleted successfully" })
}

// @desc Update user role
// @route PATCH /api/users/:id/role
// @access Admin
export const updateUserRole = async (req, res) => {
  const { role } = req.body
  if (!["admin", "student", "guest"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" })
  }

  const user = await User.findById(req.params.id)
  if (!user) {
    return res.status(404).json({ message: "User not found" })
  }

  user.role = role
  await user.save()

  res.json({ message: "User role updated", user })
}
