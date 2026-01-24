const db = require('./../db');

// Return current authenticated user (legacy endpoint kept for compatibility)
exports.createUser = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
    }

    const { rows } = await db.query('SELECT id, email, name FROM users WHERE id = $1', [userId]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.getUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.updateUser = async (req, res) => {
  const { userId } = req.params;
  const { email, name } = req.body;

  try {
    const { rows: existingRows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const existingUser = existingRows[0];

    if (!existingUser) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    await db.query(
      'UPDATE users SET email = COALESCE($1, email), name = COALESCE($2, name) WHERE id = $3',
      [email, name, userId]
    );

    const { rows } = await db.query('SELECT id, email, name FROM users WHERE id = $1', [userId]);
    const updatedUser = rows[0];

    res.status(200).json({ status: 'success', data: { user: updatedUser } });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [userId]);

    if (!rowCount) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

