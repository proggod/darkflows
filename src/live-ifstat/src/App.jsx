import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import NetworkStatus from './components/NetworkStatus';
import DhcpReservations from './components/DhcpReservations';
import BandwidthUsage from './components/BandwidthUsage';
import SystemStatus from './components/SystemStatus';

function App() {
    return (
        <Container fluid>
            <Row>
                <Col md={4}>
                    <SystemStatus />
                    <NetworkStatus />
                </Col>
                <Col md={4}>
                    <BandwidthUsage />
                </Col>
                <Col md={4}>
                    <DhcpReservations />
                </Col>
            </Row>
        </Container>
    );
}

export default App; 