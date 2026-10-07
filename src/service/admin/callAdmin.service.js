import { CALL_REPOSITORY } from "../../repository/call.repository.js"

const onGetData = async({ filters, page, limit }) => {
    try {
        const dataCalls = await CALL_REPOSITORY.findCallsByAdmin({ filters, page, limit })
        return dataCalls
    } catch (error) {
        throw error
    }
}

export const CALL_ADMIN_SERVICE = {
    onGetData
}