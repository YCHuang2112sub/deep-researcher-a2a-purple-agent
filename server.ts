
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
    capabilities: {
        generation: {
            type: "generation",
            description: "Generates high-quality slide decks from research data"
        }
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [],
    url: "http://agent:9009",
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

app.post(['/', '/generate'], async (req, res) => {
    console.log("\n[REQUEST] POST /generate - New Generation Request");
    console.log('[DEBUG] Request body keys:', Object.keys(req.body));
    const params = req.body.params || {};
    let { input } = req.body; // Expecting research_data object

    // ADAPTATION FOR AGENTBEATS PROTOCOL WRAPPER
    // The client sends the payload inside params.message.parts[0].text as a JSON string
    if (!input && req.body.params?.message?.parts?.[0]?.text) {
        try {
            console.log("[ANTIGRAVITY] Detected AgentBeats Message Wrapper. Attempting to unwrap...");
            const innerData = JSON.parse(req.body.params.message.parts[0].text);
            if (innerData.input) {
                input = innerData.input;
                console.log("[ANTIGRAVITY] Successfully unwrapped payload.");
            }
        } catch (e) {
            console.error("[ANTIGRAVITY] Failed to unwrap AgentBeats Message:", e);
        }
    }

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
            format: [1920, 1080],
            compress: true
        });

        // Load default font
        pdf.setFont("Helvetica", "normal");

        for (let i = 0; i < input.slides.length; i++) {
            const slideData = input.slides[i];

            // Rate limiting: Wait before generating subsequent slides to avoid image model overload
            if (i > 0) {
                console.log("[DEBUG] Waiting 10s before next slide validation to respect API rate limits...");
                await new Promise(resolve => setTimeout(resolve, 10000));
            }

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
                    // Text Left, Image Right
                    pdf.setFillColor('#030712');
                    pdf.rect(0, 0, 960, 1080, 'F');

                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont("Helvetica", "bold");
                    pdf.setFontSize(60);
                    pdf.text(design.title.toUpperCase(), 80, 200, { maxWidth: 800 });

                    if (design.points && design.points.length > 0) {
                        pdf.setFont("Helvetica", "normal");
                        pdf.setFontSize(32);
                        let yPos = 350;
                        console.log(`[PDF] Rendering ${design.points.length} points for split-left`);
                        design.points.forEach((point: string, idx: number) => {
                            pdf.setFillColor('#EAB308');
                            pdf.circle(95, yPos - 10, 6, 'F');
                            pdf.setTextColor(226, 232, 240); // #E2E8F0
                            const lines = pdf.splitTextToSize(point, 750);
                            console.log(`[PDF] Point ${idx} lines:`, lines);
                            pdf.text(lines, 130, yPos);
                            yPos += lines.length * 45 + 30;
                        });
                    }

                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 960, 0, 960, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for split-left layout");
                        }
                    }
                    break;

                case 'split-right':
                    // Image Left, Text Right
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 0, 0, 960, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for split-right layout");
                        }
                    }

                    pdf.setFillColor('#030712');
                    pdf.rect(960, 0, 960, 1080, 'F');

                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont("Helvetica", "bold");
                    pdf.setFontSize(60);
                    pdf.text(design.title.toUpperCase(), 1040, 200, { maxWidth: 800 });

                    if (design.points && design.points.length > 0) {
                        pdf.setFont("Helvetica", "normal");
                        pdf.setFontSize(32);
                        let yPos = 350;
                        console.log(`[PDF] Rendering ${design.points.length} points for split-right`);
                        design.points.forEach((point: string, idx: number) => {
                            pdf.setFillColor('#EAB308');
                            pdf.circle(1055, yPos - 10, 6, 'F');
                            pdf.setTextColor(226, 232, 240); // #E2E8F0
                            const lines = pdf.splitTextToSize(point, 750);
                            console.log(`[PDF] Point ${idx} lines:`, lines);
                            pdf.text(lines, 1090, yPos);
                            yPos += lines.length * 45 + 30;
                        });
                    }
                    break;

                case 'bottom-overlay':
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for bottom-overlay layout");
                        }
                    }
                    // Overlay at bottom
                    pdf.setFillColor(2, 6, 23); // #020617
                    try {
                        pdf.setGState(new (pdf as any).GState({ opacity: 0.8 }));
                        pdf.rect(0, 700, 1920, 380, 'F');
                        pdf.setGState(new (pdf as any).GState({ opacity: 1.0 }));
                    } catch (e) {
                        // Fallback if GState fails in node environment
                        pdf.rect(0, 700, 1920, 380, 'F');
                    }

                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont("Helvetica", "bold");
                    pdf.setFontSize(70);
                    pdf.text(design.title.toUpperCase(), 80, 820, { maxWidth: 1760 });

                    if (design.points && design.points.length > 0) {
                        pdf.setFont("Helvetica", "normal");
                        pdf.setFontSize(28);
                        let yPos = 940;
                        design.points.slice(0, 2).forEach((point: string) => {
                            pdf.setFillColor('#EAB308');
                            pdf.circle(95, yPos - 8, 6, 'F');
                            pdf.setTextColor('#E2E8F0');
                            const lines = pdf.splitTextToSize(point, 1700);
                            pdf.text(lines, 130, yPos);
                            yPos += lines.length * 40 + 20;
                        });
                    }
                    break;

                case 'centered':
                default:
                    if (imageUrl) {
                        try {
                            pdf.addImage(imageUrl, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
                        } catch (e) {
                            console.warn("[PDF] Could not add image for centered layout");
                        }
                    }
                    // Full overlay
                    pdf.setFillColor(2, 6, 23); // #020617
                    try {
                        pdf.setGState(new (pdf as any).GState({ opacity: 0.6 }));
                        pdf.rect(0, 0, 1920, 1080, 'F');
                        pdf.setGState(new (pdf as any).GState({ opacity: 1.0 }));
                    } catch (e) {
                        // Fallback
                        pdf.rect(0, 0, 1920, 1080, 'F');
                    }

                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont("Helvetica", "bold");
                    pdf.setFontSize(80);
                    pdf.text(design.title.toUpperCase(), 960, 400, { align: 'center', maxWidth: 1600 });

                    pdf.setFillColor('#EAB308');
                    pdf.rect(860, 480, 200, 8, 'F');

                    if (design.points && design.points.length > 0) {
                        pdf.setFont("Helvetica", "normal");
                        pdf.setFontSize(36);
                        let yPos = 600;
                        console.log(`[PDF] Rendering ${design.points.length} points for centered`);
                        design.points.forEach((point: string, idx: number) => {
                            pdf.setTextColor(226, 232, 240); // #E2E8F0
                            const lines = pdf.splitTextToSize(point, 1400);
                            console.log(`[PDF] Point ${idx} lines:`, lines);
                            pdf.text(lines, 960, yPos, { align: 'center' });
                            yPos += lines.length * 60;
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

        const isJsonRpc = req.body.jsonrpc === "2.0";
        const requestId = req.body.id || null;

        const resultPayload = {
            role: "agent",
            messageId: params.messageId || ("msg-" + Date.now()),
            parts: [
                {
                    text: JSON.stringify({
                        status: "success",
                        pdf: pdfBase64,
                        json: projectData
                    })
                }
            ]
        };

        if (isJsonRpc) {
            res.json({
                jsonrpc: "2.0",
                id: requestId,
                result: resultPayload
            });
        } else {
            res.json({
                status: "success",
                pdf: pdfBase64,
                json: projectData
            });
        }

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
