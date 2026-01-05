import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uuid } from '../constants';

export const uploadFileToStorage = async (file: File, folder: string = 'materials'): Promise<string> => {
    if (!file) throw new Error("Nenhum arquivo fornecido.");

    // Create a unique filename: materials/randomID-filename.pdf
    const filename = `${folder}/${uuid()}-${file.name}`;
    const storageRef = ref(storage, filename);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Erro no upload do arquivo:", error);
        throw new Error("Falha ao enviar arquivo para o servidor.");
    }
};