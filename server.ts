
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

            // 1. Generate Design, Script, and Image (using frontend's default personas from App.tsx lines 21-22)
            const speakerPersona = "How a renowned YouTuber would speak with high energy, vibe, and hype—BUT keeping all the technical details and authenticity. Never hallucinate or invent baseless points; stay strictly grounded in the research while making it sound legendary.";
            const visualPersona = "A renowned illustrator who uses visual storytelling to bring users through a captivating narrative. The tone is artistic, evocative, and educational, focusing on how each fact fits into a larger story.";

            const design = await designSlide(
                slideData.title,
                slideData.findings || "No findings provided.",
                speakerPersona,
                visualPersona
            );

            const [script, imageUrl] = await Promise.all([
                generateSlideScript(design, speakerPersona),
                generateImage(design.visualPrompt, visualPersona)
            ]);
            console.log(`[DEBUG] Script and Image generated for: ${slideData.title}`);

            // 2. Add page (after first slide)
            if (i > 0) pdf.addPage([1920, 1080], 'landscape');

            // 3. Render based on layout (matching SlideRenderer.tsx exactly)
            const layout = design.layout || 'centered';

            switch (layout) {
                case 'split-left':
                    // Left half: text panel, Right half: image
                    pdf.setFillColor(2, 6, 23); // bg-[#020617]
                    pdf.rect(0, 0, 1920, 1080, 'F');

                    // Text panel (left half)
                    pdf.setFillColor(3, 7, 18); // Darker panel bg
                    pdf.rect(0, 0, 960, 1080, 'F');

                    // Title
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFontSize(60);
                    pdf.text(design.title.toUpperCase(), 80, 200, { maxWidth: 800 });

                    // Bullet points
                    if (design.points && design.points.length > 0) {
                        pdf.setFontSize(28);
                        let yPos = 320;
                        design.points.forEach((point: string) => {
                            // Bullet dot
                            pdf.setFillColor(234, 179, 8); // yellow-500
                            pdf.circle(90, yPos - 5, 5, 'F');

                            // Text
                            pdf.setTextColor(226, 232, 240); // slate-200
                            const lines = pdf.splitTextToSize(point, 750);
                            pdf.text(lines, 120, yPos);
                            yPos += lines.length * 40 + 30;
                        });
                    }

                    // Image (right half)
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 960, 0, 960, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for split-left layout");
                        }
                    }
                    break;

                case 'split-right':
                    // Left half: image, Right half: text panel
                    pdf.setFillColor(2, 6, 23);
                    pdf.rect(0, 0, 1920, 1080, 'F');

                    // Image (left half)
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 0, 0, 960, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for split-right layout");
                        }
                    }

                    // Text panel (right half)
                    pdf.setFillColor(3, 7, 18);
                    pdf.rect(960, 0, 960, 1080, 'F');

                    // Title
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFontSize(60);
                    pdf.text(design.title.toUpperCase(), 1040, 200, { maxWidth: 800 });

                    // Bullet points
                    if (design.points && design.points.length > 0) {
                        pdf.setFontSize(28);
                        let yPos = 320;
                        design.points.forEach((point: string) => {
                            pdf.setFillColor(234, 179, 8);
                            pdf.circle(1050, yPos - 5, 5, 'F');
                            pdf.setTextColor(226, 232, 240);
                            const lines = pdf.splitTextToSize(point, 750);
                            pdf.text(lines, 1080, yPos);
                            yPos += lines.length * 40 + 30;
                        });
                    }
                    break;

                case 'bottom-overlay':
                    // Full image with bottom text overlay
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for bottom-overlay layout");
                        }
                    }

                    // Gradient overlay (simulated with semi-transparent rect)
                    pdf.setFillColor(2, 6, 23);
                    // Note: jsPDF opacity support is limited, using darker color instead
                    pdf.rect(0, 700, 1920, 380, 'F');

                    // Title
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFontSize(70);
                    pdf.text(design.title.toUpperCase(), 80, 800, { maxWidth: 1760 });

                    // Bullet points
                    if (design.points && design.points.length > 0) {
                        pdf.setFontSize(26);
                        let yPos = 920;
                        design.points.slice(0, 2).forEach((point: string) => { // Limit to 2 for space
                            pdf.setFillColor(234, 179, 8);
                            pdf.circle(90, yPos - 5, 5, 'F');
                            pdf.setTextColor(226, 232, 240);
                            const lines = pdf.splitTextToSize(point, 1700);
                            pdf.text(lines, 120, yPos);
                            yPos += lines.length * 35 + 20;
                        });
                    }
                    break;

                case 'centered':
                default:
                    // Full image with centered text overlay
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for centered layout");
                        }
                    }

                    // Dark overlay
                    pdf.setFillColor(2, 6, 23);
                    // Note: jsPDF opacity support is limited, using darker color instead
                    pdf.rect(0, 0, 1920, 1080, 'F');

                    // Title (centered)
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFontSize(70);
                    pdf.text(design.title.toUpperCase(), 960, 350, { align: 'center', maxWidth: 1600 });

                    // Yellow divider
                    pdf.setFillColor(234, 179, 8);
                    pdf.rect(860, 450, 200, 6, 'F');

                    // Bullet points (centered)
                    if (design.points && design.points.length > 0) {
                        pdf.setFontSize(28);
                        let yPos = 540;
                        design.points.forEach((point: string) => {
                            pdf.setFillColor(234, 179, 8);
                            const textWidth = pdf.getTextWidth(point);
                            const startX = 960 - textWidth / 2;
                            pdf.circle(startX - 20, yPos - 5, 5, 'F');
                            pdf.setTextColor(226, 232, 240);
                            pdf.text(point, 960, yPos, { align: 'center', maxWidth: 1400 });
                            yPos += 50;
                        });
                    }
                    break;
            }

            console.log(`[PDF] Rendered slide ${i + 1} with layout: ${layout}`);
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

        // Save to mounted volume
        try {
            if (!fs.existsSync('/app/debug_output')) fs.mkdirSync('/app/debug_output', { recursive: true });
            fs.writeFileSync('/app/debug_output/purple_output.pdf', Buffer.from(pdfBase64, 'base64'));
            fs.writeFileSync('/app/debug_output/purple_output.json', JSON.stringify(projectData, null, 2));
            console.log("[DEBUG] Saved purple_output.pdf and .json to /app/debug_output");
        } catch (e) { console.error("[DEBUG] Failed to save to volume:", e); }

        console.log("[DEBUG] Saved research_output.pdf and .json to debug path");

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
