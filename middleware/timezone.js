export const updateTimezone = async (req, res, next) => {
    if (req.user && req.body.timezone) {
        await User.findByIdAndUpdate(req.user.id, {
            userTimeZone: req.body.timezone
        });
    }
    next();
};
