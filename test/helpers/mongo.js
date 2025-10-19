export async function clearAllCollections (db, collections) {
  for (const collection of Object.keys(collections)) {
    await db.collection(collection).deleteMany({})
  }
}
