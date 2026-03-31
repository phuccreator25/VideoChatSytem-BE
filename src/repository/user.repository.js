import { USER_MODEL } from '../models/user.model.js'
import{GET_DB} from '../config/database.js'
import { ObjectId } from 'mongodb';

const createOne = async (data) => {
    const dataValidate = await USER_MODEL.validateData(data)
    return GET_DB().collection(USER_MODEL.COLECTION_USER_NAME).insertOne(dataValidate);    
}

const activeAcount = async (email) => {
  const result = await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOneAndUpdate(
      { email, isActive: false },
      {
        $set: {
          isActive: true,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

  return result;
};

const findById = async(_id) => {
    const data = GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
                        .findOne({_id: new ObjectId(_id)})
    return data
}

const findByEmail = async(data) => {
    const isChecked = GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
                        .findOne({email: data})
    return isChecked
}

const updateOne = async (data) => {
  return GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .updateOne(
      { email: data.email },
      {
        $set: {
          password: data.password
        }
      }
    )
}
export const USER_REPOSITORY = {
    createOne, findById, findByEmail, activeAcount, updateOne
}