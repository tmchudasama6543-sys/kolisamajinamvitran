'use server';
/**
 * @fileOverview A Genkit flow for extracting student information from Marksheet and Aadhar card images.
 *
 * - extractStudentInfoFromDocuments - A function that handles the extraction process.
 * - ExtractStudentInfoInput - The input type for the extractStudentInfoFromDocuments function.
 * - ExtractStudentInfoOutput - The return type for the extractStudentInfoFromDocuments function.
 */

import { ai } from '@/ai/genkit';
import { palitanaVillages } from '@/lib/palitana-villages';
import { z } from 'genkit';

const ExtractStudentInfoInputSchema = z.object({
  marksheetDataUri: z
    .string()
    .describe(
      "A photo of the student's marksheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  aadharDataUri: z
    .string()
    .describe(
      "A photo of the student's Aadhar card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type ExtractStudentInfoInput = z.infer<typeof ExtractStudentInfoInputSchema>;

const ExtractStudentInfoOutputSchema = z.object({
  studentName: z.string().describe('વિદ્યાર્થીનું પૂરું નામ જે માર્કશીટમાંથી કાઢવામાં આવ્યું છે. આ નામ કેપિટલ અક્ષરોમાં હોવું જોઈએ.'),
  totalMarks: z.number().describe('માર્કશીટ માટેના કુલ સંભવિત ગુણ.'),
  obtainedMarks: z.number().describe('વિદ્યાર્થી દ્વારા મેળવેલા ગુણ.'),
  standard: z.string().describe('વિદ્યાર્થીનો ગ્રેડ અથવા ધોરણ (દા.ત., 10, 12).'),
  mobileNumber: z.string().describe('વિદ્યાર્થી અથવા વાલીનો મોબાઇલ નંબર.'),
  villageName: z.string().describe('આધાર કાર્ડમાંથી કાઢવામાં આવેલ ગામનું નામ.'),
});
export type ExtractStudentInfoOutput = z.infer<typeof ExtractStudentInfoOutputSchema>;

export async function extractStudentInfoFromDocuments(
  input: ExtractStudentInfoInput
): Promise<ExtractStudentInfoOutput> {
  return extractStudentInfoFlow(input);
}

const extractStudentInfoPrompt = ai.definePrompt({
  name: 'extractStudentInfoPrompt',
  input: { schema: ExtractStudentInfoInputSchema },
  output: { schema: ExtractStudentInfoOutputSchema },
  prompt: `You are an expert at extracting student information from academic marksheets and government identification cards from India.

Carefully analyze the provided images and extract the following information.
Ensure you accurately identify and provide the requested fields.

---
Marksheet Information:
Photo: {{media url=marksheetDataUri}}

Extract the following from the Marksheet:
- Student's Full Name. The extracted name MUST be in ALL CAPITAL LETTERS.
- Total Possible Marks
- Marks Obtained by the student
- Standard (ધોરણ) (e.g., 10, 12, FY, SY, TY)

---
Aadhar Card Information:
Photo: {{media url=aadharDataUri}}

Extract the following from the Aadhar card:
- Mobile Number
- Village Name. The village name MUST be one of the following from this list: ${palitanaVillages.join(', ')}. Find the best match from the address on the Aadhar card.

Your output MUST be a JSON object conforming to the following structure:
{{output.schema}}`,
});

const extractStudentInfoFlow = ai.defineFlow(
  {
    name: 'extractStudentInfoFlow',
    inputSchema: ExtractStudentInfoInputSchema,
    outputSchema: ExtractStudentInfoOutputSchema,
  },
  async (input) => {
    const { output } = await extractStudentInfoPrompt(input);
    return output!;
  }
);
