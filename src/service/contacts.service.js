import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js"

const onGetData = async(currentUser) => {
    const contacts = await CONTACTS_REPOSITORY.findMany(currentUser)
    // console.log(contacts);
    return contacts
    
}


export const CONTACT_SERVICE = {
    onGetData
}