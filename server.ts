
import './env-setup';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore
import { jsPDF } from 'jspdf';
import { planResearchSteps, executeSearch, designSlide, generateSlideScript, generateImage, synthesizeReport, critiqueFindings, auditScript } from './services/geminiService';

dotenv.config({ path: '.env.local' });

console.log('[DEBUG] GEMINI_API_KEY loaded:', process.env.GEMINI_API_KEY ? 'YES (' + process.env.GEMINI_API_KEY.substring(0, 4) + '...)' : 'NO');

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

        // Use jsPDF (same as frontend's PresentationView.tsx)
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [1920, 1080]
        });

        for (let i = 0; i < input.slides.length; i++) {
            const slideData = input.slides[i];
            console.log(`[DEBUG] Starting generation for slide: ${slideData.title}`);

            // 1. Generate Design, Script, and Image (using frontend's default personas)
            const design = await designSlide(
                slideData.title,
                slideData.findings || "No findings provided.",
                "Confident technology analyst with an approachable, energizing tone",  // Default speakerPersona from App.tsx
                "Ultra-realistic, cinematic 3D imagery with dramatic lighting and hyper-detailed textures"  // Default visualPersona from App.tsx
            );

            const [script, imageUrl] = await Promise.all([
                generateSlideScript(design, "Confident technology analyst with an approachable, energizing tone"),
                generateImage(design.visualPrompt, "Ultra-realistic, cinematic 3D imagery with dramatic lighting and hyper-detailed textures")
            ]);
            console.log(`[DEBUG] Script and Image generated for: ${slideData.title}`);

            // 2. Add page (after first slide)
            if (i > 0) pdf.addPage([1920, 1080], 'landscape');

            // 3. Add black background
            pdf.setFillColor(0, 0, 0);
            pdf.rect(0, 0, 1920, 1080, 'F');

            // 4. Add image if available (EXACTLY like frontend)
            if (imageUrl) {
                try {
                    // In Node.js, we can't use DOM's Image(), but we can use the data URI directly
                    // jsPDF supports base64 data URIs
                    pdf.addImage(imageUrl, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
                } catch (e) {
                    console.warn("[DEBUG] Could not add image to PDF for slide", i, e);
                }
            }

            // 5. Add title overlay (EXACTLY like frontend - line 108-110)
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(40);
            pdf.text(design.title, 60, 100);
        }

        // Get PDF as base64
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
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
        // Save for local debugging
        fs.writeFileSync('research_output.pdf', Buffer.from(pdfBase64, 'base64'));
        fs.writeFileSync('research_output.json', JSON.stringify(projectData, null, 2));

        console.log("[DEBUG] Saved research_output.pdf and .json to disk");

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
