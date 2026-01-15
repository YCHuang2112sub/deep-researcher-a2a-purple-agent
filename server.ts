
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { planResearchSteps, executeSearch, designSlide, generateSlideScript, generateImage } from './services/geminiService';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Basic argument parsing
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const hostArg = args.indexOf('--host');

const PORT = portArg !== -1 ? parseInt(args[portArg + 1]) : (process.env.PORT ? parseInt(process.env.PORT) : 9010);
const HOST = hostArg !== -1 ? args[hostArg + 1] : '0.0.0.0';

/**
 * A2A Agent Card Endpoint
 */
const getAgentCard = () => ({
    name: "StorySlide AI Purple Agent",
    description: "Purple Agent for generating research-based slide decks.",
    version: "1.0.0",
    capabilities: ["generation"],
    endpoints: {
        generate: "/generate"
    }
});

app.get('/', (req, res) => {
    res.json(getAgentCard());
});

app.get('/.well-known/agent-card.json', (req, res) => {
    res.json(getAgentCard());
});

app.post('/generate', async (req, res) => {
    console.log("\n--- New Generation Request ---");
    const { input } = req.body; // Expecting research_data object

    if (!input || !input.slides) {
        return res.status(400).json({ error: "Invalid input: research_data.slides missing" });
    }

    try {
        console.log(`Generating slides for: ${input.title || 'Untitled'}`);

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const slideData of input.slides) {
            console.log(`Processing slide: ${slideData.title}`);

            // 1. Re-run design and asset generation to get visuals and script
            // In a real scenario, we might use the incoming findings to generate fresh assets
            // For now, we follow the flow: Design -> Script -> Image

            const design = await designSlide(
                slideData.title,
                slideData.findings || "No findings provided.",
                "Professional narrator",
                "Cinematic educational style"
            );

            // Generate Script and Image concurrently
            const [script, imageUrl] = await Promise.all([
                generateSlideScript(design, "Professional narrator"),
                generateImage(design.visualPrompt, "Cinematic educational style")
            ]);

            // 2. Add Page to PDF
            const page = pdfDoc.addPage([800, 600]);

            // Draw Title
            page.drawText(design.title, {
                x: 50,
                y: 550,
                size: 24,
                font: font,
                color: rgb(0.1, 0.1, 0.1),
            });

            // Draw Points
            let yPos = 500;
            for (const point of design.points) {
                page.drawText(`• ${point}`, {
                    x: 70,
                    y: yPos,
                    size: 14,
                    font: textFont,
                    color: rgb(0.3, 0.3, 0.3),
                });
                yPos -= 25;
            }

            // Draw Script (as metadata/comment or just text at the bottom)
            page.drawText("Speaker Note:", {
                x: 50,
                y: 100,
                size: 10,
                font: font,
                color: rgb(0.5, 0.5, 0.5),
            });

            const lines = script.match(/.{1,100}/g) || [];
            let scriptY = 85;
            for (const line of lines.slice(0, 3)) {
                page.drawText(line, {
                    x: 50,
                    y: scriptY,
                    size: 9,
                    font: textFont,
                    color: rgb(0.4, 0.4, 0.4),
                });
                scriptY -= 12;
            }

            // Note: Embedding images in PDF with pdf-lib is possible but requires fetching and buffer conversion.
            // For this baseline, we focus on the text and structure which the Green Agent's PDFProcessor extracts.
            // If the Green Agent specifically needs images, we would embed them here.
        }

        const pdfBase64 = await pdfDoc.saveAsBase64();
        console.log("PDF generated successfully. Size:", pdfBase64.length);

        res.json({
            status: "success",
            pdf: pdfBase64
        });

    } catch (error: any) {
        console.error("Generation failed:", error);
        res.status(500).json({
            status: "failed",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Purple Agent listening on port ${PORT}`);
});
