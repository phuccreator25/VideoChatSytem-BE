import { USER_ADMIN_SERVICE } from "../../service/admin/userAdmin.service.js"

const parseBooleanQuery = (value) => {
    if (value === undefined || value === 'all') return undefined;
    return value === 'true';
};

const onGetDataUser = async(req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

        const filter = {};
        
        const isActive = parseBooleanQuery(req.query.isActive);
        if (isActive !== undefined) filter.isActive = isActive;

        const isOnline = parseBooleanQuery(req.query.isOnline);
        if (isOnline !== undefined) filter.isOnline = isOnline;

        const isBanned = parseBooleanQuery(req.query.isBanned);
        if (isBanned !== undefined) filter.isBanned = isBanned;

        if (req.query.role && req.query.role !== 'all') {
            filter.role = req.query.role;
        }

        const dataUsers = await USER_ADMIN_SERVICE.onGetDataUser({ filter, page, limit });
        return res.status(200).json({
            data: dataUsers
        })
    } catch (error) {
        next(error)
    }
}

const onCreateAdmin = async(req, res, next) => {
    try {
        const { email, password, username, fullname } = req.body
        const adminId = req.admin.id;
        
        await USER_ADMIN_SERVICE.onCreateAdmin({ payload: { email, password, username, fullname, adminId } })

        return res.status(201).json({
            message: 'Admin created successfully'
        })
    } catch (error) {
        next(error)
    }
}

const onUpdateAdmin = async(req, res, next) => {
    try {
        const { _id } = req.params
        const { fullname, username, email, password, role } = req.body
        const adminId = req.admin.id
        
        await USER_ADMIN_SERVICE.onUpdateAdmin(
            { 
                _id, 
                payload: { fullname, username, email, password, role },
                adminId
            }
        )

        return res.status(200).json({
            message: 'Admin updated successfully'
        })
    } catch (error) {
        next(error)
    }
}

const onBanUser = async(req, res, next) => {
    try {
        const { _id } = req.params
        const { banReason } = req.body
        const adminId = req.admin.id
        
        await USER_ADMIN_SERVICE.onBanUser({ _id, payload : { banReason }, adminId })

        return res.status(200).json({
            message: 'User banned successfully'
        })
    } catch (error) {
        next(error)
    }
}

const onUnbanUser = async(req, res, next) => {
    try {
        const { _id } = req.params
        const adminId = req.admin.id

        await USER_ADMIN_SERVICE.onUnbanUser({_id, adminId})

        return res.status(200).json({
            message: 'User unbanned successfully'
        })
    } catch (error) {
        next(error)
    }
}

const onSendMailVerify = async(req, res, next) => {
    try {
        const { _id } = req.params        
        await USER_ADMIN_SERVICE.onSendMailVerify({_id})
        return res.status(200).json({
            message: 'Email sent successfully.'
        })
    } catch (error) {
        next(error)
    }
}

export const USER_ADMIN_CONTROLLER = {
    onGetDataUser,
    onCreateAdmin,
    onUpdateAdmin,
    onBanUser,
    onUnbanUser,
    onSendMailVerify,
}
