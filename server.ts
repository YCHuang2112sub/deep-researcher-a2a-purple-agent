
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { planResearchSteps, executeSearch, designSlide, generateSlideScript, generateImage, synthesizeReport, critiqueFindings, auditScript } from './services/geminiService';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Basic argument parsing
console.log('[STARTUP] Parsing command line arguments:', process.argv);
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const hostArg = args.indexOf('--host');

const PORT = portArg !== -1 ? parseInt(args[portArg + 1]) : (process.env.PORT ? parseInt(process.env.PORT) : 9010);
console.log('[STARTUP] PORT configured as:', PORT);
const HOST = hostArg !== -1 ? args[hostArg + 1] : '0.0.0.0';

/**
 * A2A Agent Card Endpoint
 */
const getAgentCard = () => ({
    name: "StorySlide AI Purple Agent",
    description: "An AI-powered Purple Agent specializes in generating structured, research-driven slide decks. It transforms raw research data into visually engaging slides with coherent speaker notes and clear logical flow, suitable for professional presentations.",
    version: "1.0.0",
    type: "purple",
    capabilities: ["generation"],
    skills: [],
    endpoints: {
        generate: "/generate"
    }
});

app.get('/', (req, res) => {
    console.log('[REQUEST] GET / - Sending agent card');
    res.json(getAgentCard());
});

app.get('/.well-known/agent-card.json', (req, res) => {
    console.log('[REQUEST] GET /.well-known/agent-card.json - Sending agent card');
    res.json(getAgentCard());
});

app.post('/generate', async (req, res) => {
    console.log("\n[REQUEST] POST /generate - New Generation Request");
    console.log('[DEBUG] Request body keys:', Object.keys(req.body));
    let { input } = req.body; // Expecting research_data object

    // MODE A: Full Research Mode (Query provided, no pre-cooked slides)
    if (input && input.query && (!input.slides || input.slides.length === 0)) {
        console.log(`[MODE] Deep Research initiated for query: "${input.query}"`);
        try {
            // 1. Plan
            console.log("[RESEARCH] Planning steps...");
            const plannedSteps = await planResearchSteps(input.query);
            const finalSteps = [...plannedSteps];

            // 2. Execute Research Loop (Investigate -> Critique -> Refine)
            for (let i = 0; i < finalSteps.length; i++) {
                let iteration = 0;
                let isSufficient = false;
                const maxIterations = 2;

                while (iteration < maxIterations && !isSufficient) {
                    console.log(`[RESEARCH] Step ${i + 1}/${finalSteps.length} - Iteration ${iteration}: ${finalSteps[i].title}`);

                    const searchResult = await executeSearch(
                        finalSteps[i].title,
                        iteration > 0 ? finalSteps[i].feedback : undefined,
                        finalSteps[i].findings
                    );

                    const updatedFindings = iteration === 0
                        ? searchResult.findings
                        : `${finalSteps[i].findings}\n\n[Refinement ${iteration}]:\n${searchResult.findings}`;

                    finalSteps[i] = {
                        ...finalSteps[i],
                        findings: updatedFindings,
                        findingsHistory: [...(finalSteps[i].findingsHistory || []), searchResult.findings],
                        sources: [...(finalSteps[i].sources || []), ...searchResult.sources]
                    };

                    // Critique
                    const critique = await critiqueFindings(finalSteps[i].title, updatedFindings);
                    if (critique.sufficient || iteration >= maxIterations - 1) {
                        isSufficient = true;
                        finalSteps[i].status = 'completed';
                    } else {
                        finalSteps[i].feedback = critique.refinedQuery || critique.feedback;
                        iteration++;
                    }
                }
            }

            // 3. Synthesize Report (Optional but good for context)
            console.log("[RESEARCH] Synthesizing final report...");
            // const report = await synthesizeReport(input.query, finalSteps); 
            // We verify synthesis works but for slides we use the steps directly.

            // 4. Map to 'slides' format for generation
            // The existing logic expects input.slides = [{title, findings}, ...]
            input.title = input.query.toUpperCase(); // Set deck title
            input.slides = finalSteps.map(step => ({
                title: step.title,
                findings: step.findings
            }));

            console.log(`[RESEARCH] Completed. Generated ${input.slides.length} slides from research.`);

        } catch (researchError: any) {
            console.error("Deep Research Failed:", researchError);
            return res.status(500).json({ error: "Research failed: " + researchError.message });
        }
    }

    // MODE B: Slide Generation (Standard Flow)
    if (!input || !input.slides) {
        return res.status(400).json({ error: "Invalid input: research_data.slides (or query) missing" });
    }

    try {
        console.log(`[DEBUG] Generating slides for: ${input.title || 'Untitled'}`);
        console.log(`[DEBUG] Number of slides requested: ${input.slides?.length || 0}`);

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const slideData of input.slides) {
            console.log(`[DEBUG] Starting generation for slide: ${slideData.title}`);

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
            console.log(`[DEBUG] Script and Image generated for: ${slideData.title}`);

            // 2. Add Page to PDF (Match PresentationView.tsx style: 1920x1080, Black Background)
            const page = pdfDoc.addPage([1920, 1080]);
            const { width, height } = page.getSize();

            // Draw Black Background
            page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: height,
                color: rgb(0, 0, 0),
            });

            // Draw Title (White, Large)
            page.drawText(design.title, {
                x: 100,
                y: height - 150, // Top-left ish
                size: 60,
                font: font,
                color: rgb(1, 1, 1),
            });

            // Draw Body Text (Findings summary) - Frontend doesn't do this in PDF but SlideRenderer does.
            // We adding it for context since we might not have an image
            const bodyText = slideData.findings ? slideData.findings.substring(0, 300) + '...' : '';
            page.drawText(bodyText, {
                x: 100,
                y: height - 300,
                size: 24,
                font: textFont,
                color: rgb(0.8, 0.8, 0.8),
                maxWidth: 1000,
                lineHeight: 32
            });

            // Try to fetch and embed image if URL exists
            if (imageUrl) {
                try {
                    // In a real Node env, we need to fetch the image data from the URL (data uri or http)
                    let imageBytes;
                    if (imageUrl.startsWith('data:')) {
                        imageBytes = Buffer.from(imageUrl.split(',')[1], 'base64');
                    } else {
                        // Fallback for http urls (not implemented here without axios/fetch, assuming data-uri from gemini)
                        console.warn("[DEBUG] Image is URL, skipping embed for now:", imageUrl.substring(0, 20));
                    }

                    if (imageBytes) {
                        const embeddedImage = await pdfDoc.embedJpg(imageBytes); // Assuming JPEG for now, strictly check mime in real code
                        // Draw full screen or cover? Frontend does pdf.addImage(..., 1920, 1080)
                        page.drawImage(embeddedImage, {
                            x: 0,
                            y: 0,
                            width: width,
                            height: height,
                            opacity: 0.6 // Slight overlay effect so text is readable
                        });

                        // Redraw text on top if needed
                        page.drawText(design.title, {
                            x: 100,
                            y: height - 150,
                            size: 60,
                            font: font,
                            color: rgb(1, 1, 1),
                        });
                    }
                } catch (imgErr) {
                    console.error("Failed to embed image:", imgErr);
                }
            }

            // Draw Script as "Speaker Notes" (Bottom)
            page.drawText("SPEAKER SCRIPT:", {
                x: 100,
                y: 150,
                size: 14,
                font: font,
                color: rgb(1, 0.8, 0), // Yellow accent
            });

            page.drawText(script.substring(0, 500), {
                x: 100,
                y: 120,
                size: 14,
                font: textFont,
                color: rgb(0.9, 0.9, 0.9),
                maxWidth: 1700,
                lineHeight: 20
            });
        }

        const pdfBase64 = await pdfDoc.saveAsBase64();
        console.log("PDF generated successfully. Size:", pdfBase64.length);

        // Construct project_data.json structure
        const projectData = {
            originalQuery: input.title || "No input provided.",
            exportedAt: new Date().toISOString(),
            slides: input.slides.map((s: any, i: number) => ({
                slideIndex: i + 1,
                title: s.title,
                findings: s.findings,
                speakerNote: "Generated script...", // We should capture the generated scripts in an array to map correctly here
                sources: []
            }))
        };

        // DEBUG: Save to disk to verify content
        const fs = await import('fs');
        await fs.promises.writeFile('debug_output.pdf', Buffer.from(pdfBase64, 'base64'));
        await fs.promises.writeFile('debug_output.json', JSON.stringify(projectData, null, 2));

        console.log("[DEBUG] Saved debug_output.pdf and .json to disk");

        res.json({
            status: "success",
            pdf: pdfBase64,
            json: projectData
        });

    } catch (error: any) {
        console.error("Generation failed:", error);
        res.status(500).json({
            status: "failed",
            error: error.message
        });
    }
});

app.listen(PORT, HOST, () => {
    console.log(`[STARTUP] Purple Agent listening on ${HOST}:${PORT}`);
    console.log('[STARTUP] Healthcheck endpoint: /.well-known/agent-card.json');
    console.log('[STARTUP] Generation endpoint: /generate');
});
