import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Anomaly } from 'src/database-audit/entities/anomaly.entity';

@Injectable()
export class ReportGenerator {
    /**
     * Genera un reporte de texto plano (ya existente).
     */
    generateTextReport(anomalies: Anomaly[]): string {
        if (!anomalies.length) {
            return 'No se han detectado anomalías (o no se ha corrido el análisis).';
        }

        let report = '===== DATABASE ANOMALIES REPORT =====\n';
        report += `Generated at: ${new Date().toISOString()}\n\n`;
        report += `Total anomalies: ${anomalies.length}\n\n`;

        anomalies.forEach((a, index) => {
            report += `${index + 1}) [${a.timestamp.toISOString()}] `;
            report += `Type: ${a.type}\n`;
            report += `   Description: ${a.description}\n`;
            report += `   Table: ${a.affectedTable}\n`;
            if (a.affectedData) {
                report += `   Details: ${a.affectedData}\n`;
            }
            report += '---------------------------------------\n';
        });

        return report;
    }

    /**
     * Genera un reporte en PDF y retorna un Buffer con el contenido.
     * Puede ser devuelto desde un controller para su descarga.
     */
    async generatePdfReport(anomalies: Anomaly[]): Promise<Buffer> {
        // Creamos la instancia de PDFDocument
        const doc = new PDFDocument({
            size: 'A4',    // Tamaño de página
            margin: 50,    // Márgenes
        });

        // Almacenamos los "chunks" (fragmentos) que pdfkit va generando
        const chunks: Buffer[] = [];

        // Cuando pdfkit genere datos, los vamos pusheando al array
        doc.on('data', (chunk) => {
            chunks.push(chunk);
        });

        // Cuando termine de generar el PDF, resolveremos la Promise con el Buffer final
        const promise = new Promise<Buffer>((resolve, reject) => {
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });

            doc.on('error', (err) => {
                reject(err);
            });
        });

        // ===============================================
        // ======== ARMANDO EL CONTENIDO DEL PDF =========
        // ===============================================

        // Título
        doc
            .fontSize(16)
            .text('===== DATABASE ANOMALIES REPORT =====', { align: 'center' })
            .moveDown();

        // Fecha de generación
        doc
            .fontSize(10)
            .text(`Generated at: ${new Date().toISOString()}`)
            .moveDown();

        // Si no hay anomalías
        if (!anomalies.length) {
            doc.text('No se han detectado anomalías (o no se ha corrido el análisis).');
            // Cerramos el doc y retornamos
            doc.end();
            return promise;
        }

        // Total de anomalías
        doc
            .fontSize(10)
            .text(`Total anomalies: ${anomalies.length}`)
            .moveDown();

        // Listado de anomalías
        anomalies.forEach((a, index) => {
            doc
                .fontSize(10)
                .text(`${index + 1}) [${a.timestamp.toISOString()}] Type: ${a.type}`, {
                    continued: false,
                })
                .text(`Description: ${a.description}`)
                .text(`Table: ${a.affectedTable}`);

            if (a.affectedData) {
                doc.text(`Details: ${a.affectedData}`);
            }

            doc.moveDown().text('---------------------------------------').moveDown();
        });

        // Finaliza el PDF
        doc.end();

        // Retornamos la Promise que resolverá con el Buffer
        return promise;
    }
}
