import AdmZip from "adm-zip";
import xml2js from "xml2js";

/**
 * PPTX 파일에서 텍스트를 추출하는 함수
 * @param {string|Buffer} pptxFile - PPTX 파일 경로 또는 버퍼
 * @returns {Promise<string>} - 추출된 텍스트
 */
async function extractTextFromPptxBuffer(pptxFile: Buffer) {
  try {
    const zip = new AdmZip(pptxFile);

    const slideEntries = zip.getEntries().filter((entry) => {
      return entry.entryName.match(/ppt\/slides\/slide[0-9]+\.xml/);
    });

    slideEntries.sort((a, b) => {
      const numA = Number.parseInt(
        a.entryName.match(/slide([0-9]+)\.xml/)?.[1] ?? "0"
      );
      const numB = Number.parseInt(
        b.entryName.match(/slide([0-9]+)\.xml/)?.[1] ?? "0"
      );
      return numA - numB;
    });

    const parser = new xml2js.Parser();
    let allText = "";

    for (const entry of slideEntries) {
      const slideXml = zip.readAsText(entry.entryName);
      const result = await parser.parseStringPromise(slideXml);

      const slideNumber =
        entry.entryName.match(/slide([0-9]+)\.xml/)?.[1] ?? -1;
      allText += `\n===== 슬라이드 ${slideNumber} =====\n`;

      const slideText = extractTextFromSlide(result);
      allText += slideText;
    }

    return allText;
  } catch (error) {
    console.error("PPTX 텍스트 추출 중 오류 발생:", error);
    throw error;
  }
}

/**
 * 슬라이드 XML 객체에서 텍스트 추출
 * @param {Object} slideObj - 파싱된 슬라이드 XML 객체
 * @returns {string} - 추출된 텍스트
 */
function extractTextFromSlide(slideObj: any) {
  let text = "";

  try {
    const spTree = slideObj?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0];

    if (!spTree) return text;

    const shapes = spTree["p:sp"] || [];
    for (const shape of shapes) {
      const txBody = shape["p:txBody"]?.[0];
      if (!txBody) continue;

      const paragraphs = txBody["a:p"] || [];
      for (const paragraph of paragraphs) {
        const runs = paragraph["a:r"] || [];
        let paragraphText = "";

        for (const run of runs) {
          const textElement = run["a:t"];
          if (textElement && textElement.length > 0) {
            paragraphText += textElement[0];
          }
        }

        if (paragraphText) {
          text += `${paragraphText}\n`;
        }
      }
    }

    return text;
  } catch (error) {
    console.error("슬라이드 텍스트 추출 중 오류 발생:", error);
    return text;
  }
}

export async function extractTextFromS3Object(s3Body: ReadableStream) {
  try {
    const chunks = [];
    for await (const chunk of s3Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const text = await extractTextFromPptxBuffer(buffer);
    return text;
  } catch (error) {
    console.error("S3 객체에서 텍스트 추출 중 오류 발생:", error);
    throw error;
  }
}
