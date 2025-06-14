import Task from "../models/Task.js";

export const createTask = async (req, res) => {
  try {
    const { title, dueDate, reminderTime, repeat } = req.body;
    const { userId } = req.params;
    if (!title || !dueDate)
      return res.status(400).json({ msg: "Fill the required fields." });
    const task = new Task({
      title,
      dueDate,
      reminderTime,
      repeat,
      userId,
    });
    const createdTask = await task.save();
    await User.findByIdAndUpdate(userId, {
      $push: { taskIds: createdTask._id },
    });
    res.status(201).json(createdTask);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const { title, dueDate, reminderTime, repeat } = req.body;
    if (!userId) return res.status(400).json("User id is not present");
    if (!title || !dueDate)
      return res.status(400).json({ msg: "Fill the required fields." });
    const filter = { _id: taskId };
    const newTask = {
      title,
      dueDate,
      reminderTime,
      repeat,
    };
    const result = await Task.updateOne(filter, { $set: newTask });
    if (result.matchedCount === 0) {
      res.status(400).json({ msg: "Task not found." });
    }
    if (result.modifiedCount === 0) {
      res.status(400).json({ msg: "No change was made." });
    }
    if (result.upsertedCount > 0) {
      res.status(201).json({ msg: "A new task was added." });
    }
    res.status(200).json({ result, msg: "Task was updated successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

export const markCompleted = async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    if (!userId) return res.status(400).json({ msg: "User id is not present" });
    const filter = { _id: taskId };
    const task = await Task.findById(taskId);
    if (!task) return res.status(400).json({ msg: "Task does not exist." });
    if (!task.completed) {
      const result = await Task.updateOne(filter, {
        $set: { completed: true },
      });
      if (result.matchedCount === 0)
        return res.status(400).json({ msg: "Task was not found." });
      if (result.modifiedCount === 0)
        return res.status(400).json({ msg: "Status was not updated." });
      if (result.modifiedCount > 0)
        return res
          .status(204)
          .json({ msg: "Status was updated successfully." });
    }
    if (task.completed) {
      const result = await Task.updateOne(filter, {
        $set: { completed: false },
      });
      if (result.matchedCount === 0)
        return res.status(400).json({ msg: "Task was not found." });
      if (result.modifiedCount === 0)
        return res.status(400).json({ msg: "Status was not updated." });
      if (result.modifiedCount > 0)
        return res
          .status(204)
          .json({ msg: "Status was updated successfully." });
    }
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    if (!userId || !taskId)
      return res.status(400).json({ msg: "Parameter is absent" });
    const task = await Task.findByIdAndDelete(taskId);
    if (!task)
      return res.status(400).json({ msg: "Task was likely not found." });
    await User.findByIdAndUpdate(userId, {
      $pull: { taskIds: taskId },
    });
    res.status(204).json({ msg: "Task was deleted successfully." });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};
