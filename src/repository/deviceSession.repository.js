import { DEVICE_SESSION_MODEL } from "../models/deviceSession.model.js";
import { GET_DB } from "../config/database.js";

const findOne = async (filters) => {
    return await GET_DB().collection(DEVICE_SESSION_MODEL.COLECTION_DEVICE_SESSION_NAME)
                        .findOne(filters)
}

const createOne = async (data) => {
    const dataValidate = await DEVICE_SESSION_MODEL.validateData(data);
    return await GET_DB().collection(DEVICE_SESSION_MODEL.COLECTION_DEVICE_SESSION_NAME)
                        .insertOne(dataValidate);
}

const updateOne = async(filters, updatedData) => {
    return await GET_DB().collection(DEVICE_SESSION_MODEL.COLECTION_DEVICE_SESSION_NAME)
                        .findOneAndUpdate(
                            filters,
                            {$set: 
                                updatedData
                            },
                            {
                                returnDocument: 'after',
                            }
                        )             
}

const findMany = async (filters = {}) => {
  return await GET_DB()
    .collection(DEVICE_SESSION_MODEL.COLECTION_DEVICE_SESSION_NAME)
    .find(filters)
    .toArray();
};

export const DEVICE_SESSION_REPOSITORY = {
    findOne, createOne, updateOne, findMany
}