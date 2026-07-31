import { GET_DB } from "../config/database.js";
import { CALL_MODEL } from "../models/call.model.js";

const createOne = async (data, session = null) => {
    const dataValid = await CALL_MODEL.validateData(data);

    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .insertOne(dataValid, { session });
}

const updateOne = async (filter, updateData, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .updateOne(filter, updateData, { session });
}

const findOne = async (filter, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .findOne(filter, { session });
}

const updateMany = async (filter, updateData, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .updateMany(filter, updateData, { session });
}

const findMany = async (filter, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .find(filter, { session })
        .toArray();
}

export const CALL_REPOSITORY = {
    createOne,
    updateOne,
    findOne,
    updateMany,
    findMany,
}