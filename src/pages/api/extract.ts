import { extractStudentInfoFromDocuments } from '@/ai/flows/extract-student-info-from-documents';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { marksheetDataUri, aadharDataUri } = req.body;

  if (!marksheetDataUri || !aadharDataUri) {
    return res.status(400).json({ error: 'Missing required document data URIs.' });
  }

  try {
    const result = await extractStudentInfoFromDocuments({
      marksheetDataUri,
      aadharDataUri,
    });
    return res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error in /api/extract:', error);
    return res.status(500).json({ error: 'Failed to extract information from documents.' });
  }
}
