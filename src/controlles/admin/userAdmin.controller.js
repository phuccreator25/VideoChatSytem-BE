import { USER_ADMIN_SERVICE } from "../../service/admin/userAdmin.service.js"

const parseBooleanQuery = (value) => {
    if (value === undefined || value === 'all') return undefined;
    return value === 'true';
};

const onGetDataUser = async(req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

        const { isActive, isOnline, isBanned, role, search } = req.query;
        const filter = {};
        
        const parsedIsActive = parseBooleanQuery(isActive);
        if (parsedIsActive !== undefined) filter.isActive = parsedIsActive;

        const parsedIsOnline = parseBooleanQuery(isOnline);
        if (parsedIsOnline !== undefined) filter.isOnline = parsedIsOnline;

        const parsedIsBanned = parseBooleanQuery(isBanned);
        if (parsedIsBanned !== undefined) filter.isBanned = parsedIsBanned;

        if (role && role !== 'all') {
            filter.role = role;
        }

        if (search && search.trim() !== '') {
            filter.search = search.trim();
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
